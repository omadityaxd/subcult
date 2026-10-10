import { mapWithConcurrency, withTimeout } from "@/lib/concurrency"
import {
  type GenerationStats,
  type LlmClient,
  NICHE_MODEL,
  generateNicheProfile,
} from "@/lib/engine/generate"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import type { UsageLog, UsageStatus } from "@/lib/engine/usage"
import { type Logger, errorMessage } from "@/lib/log"
import { addDays } from "@/lib/niches/lifecycle"
import { createBudget } from "./budget"
import { findOverlap } from "./overlap"
import { proposeTrends } from "./propose"
import { mergeSignals } from "./signals"
import type {
  ExistingNiche,
  ProposalDecision,
  RawSignal,
  SignalSource,
  TrendSignal,
  TrendStore,
  WebResearcher,
} from "./types"

export interface TrendRefreshConfig {
  /** Trending niches expire (→ archived) this many days after publishing. */
  ttlDays: number
  /** Hard cap on LLM spend for one run, in USD. */
  maxCostUsd: number
  maxNew: number
  /** Active trending niches older than this get their profile regenerated. */
  refreshAfterDays: number
  maxRefreshes: number
  /** Wall-clock budget; stays well under Vercel Hobby's 300s function limit. */
  deadlineMs: number
}

export const DEFAULT_TREND_CONFIG: TrendRefreshConfig = {
  ttlDays: 42,
  maxCostUsd: 0.25,
  maxNew: 3,
  refreshAfterDays: 14,
  maxRefreshes: 3,
  deadlineMs: 240_000,
}

/** Conservative per-job estimates reserved against the budget before each call. */
export const COST_ESTIMATES = { proposal: 0.006, generation: 0.012 } as const

const SIGNAL_TIMEOUT_MS = 15_000
/** Don't start an LLM job with less than this much wall-clock left. */
const MIN_TIME_FOR_JOB_MS = 30_000
const MIN_SIGNALS = 3
const GENERATION_CONCURRENCY = 3

export interface TrendRefreshDeps {
  store: TrendStore
  /** Curated catalog, merged with DB niches for overlap checks. */
  seeds: readonly ExistingNiche[]
  signalSources: readonly SignalSource[]
  webResearch?: WebResearcher | null
  /** null when ANTHROPIC_API_KEY is missing: the run archives and stops. */
  llm: LlmClient | null
  usage?: UsageLog | null
  logger: Logger
  now?: () => Date
  config?: Partial<TrendRefreshConfig>
}

export interface TrendRunReport {
  dryRun: boolean
  skippedReason: string | null
  abortedReason: string | null
  signals: TrendSignal[]
  proposals: ProposalDecision[]
  created: string[]
  refreshed: string[]
  archived: string[]
  refreshCandidates: string[]
  failures: string[]
  spentUsd: number
  maxCostUsd: number
}

type JobOutcome<T> = { value: T | null; status: UsageStatus; stats: GenerationStats }

export async function runTrendRefresh(
  deps: TrendRefreshDeps,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<TrendRunReport> {
  const config = { ...DEFAULT_TREND_CONFIG, ...deps.config }
  const now = (deps.now ?? (() => new Date()))()
  const startedAt = Date.now()
  const timeLeft = () => config.deadlineMs - (Date.now() - startedAt)
  const budget = createBudget(config.maxCostUsd)
  const { store, logger } = deps

  const report: TrendRunReport = {
    dryRun,
    skippedReason: null,
    abortedReason: null,
    signals: [],
    proposals: [],
    created: [],
    refreshed: [],
    archived: [],
    refreshCandidates: [],
    failures: [],
    spentUsd: 0,
    maxCostUsd: config.maxCostUsd,
  }
  const finish = () => ({ ...report, spentUsd: budget.committedUsd() })

  // 1. Lifecycle housekeeping: free, and runs even without an API key.
  report.archived = dryRun ? await store.findExpired(now) : await store.archiveExpired(now)
  const candidates = await store.listRefreshCandidates(
    addDays(now, -config.refreshAfterDays),
    config.maxRefreshes,
  )
  report.refreshCandidates = candidates.map((candidate) => candidate.slug)

  if (!deps.llm && !dryRun) {
    report.skippedReason = "ANTHROPIC_API_KEY not set: archived expired trends only"
    return finish()
  }

  // 2. Free evidence first.
  const batches = await Promise.allSettled(
    deps.signalSources.map((source) =>
      withTimeout(source.gather(), SIGNAL_TIMEOUT_MS, source.name),
    ),
  )
  const raw: RawSignal[][] = batches.map((result, index) => {
    if (result.status === "fulfilled") return result.value
    report.failures.push(`${deps.signalSources[index].name}: ${errorMessage(result.reason)}`)
    return []
  })

  if (dryRun) {
    report.signals = mergeSignals(raw)
    report.skippedReason = "dry run: no LLM calls, no writes"
    return finish()
  }
  const llm = deps.llm as LlmClient

  /** Budget + deadline gate, ledger write, and failure capture around every LLM job. */
  async function runJob<T>(
    subject: string,
    estimateUsd: number,
    job: () => Promise<JobOutcome<T>>,
  ): Promise<T | null> {
    if (timeLeft() < MIN_TIME_FOR_JOB_MS) {
      report.abortedReason ??= "time budget reached; remaining work runs next time"
      return null
    }
    const reservation = budget.reserve(estimateUsd)
    if (!reservation) {
      report.abortedReason ??= `cost cap $${config.maxCostUsd.toFixed(2)} would be exceeded`
      return null
    }
    const startedJob = Date.now()
    try {
      const outcome = await job()
      reservation.settle(outcome.stats.costUsd)
      await record(subject, outcome.status, outcome.stats)
      if (outcome.value === null) report.failures.push(`${subject}: ${outcome.status}`)
      return outcome.value
    } catch (error) {
      reservation.settle(null)
      report.failures.push(`${subject}: ${errorMessage(error)}`)
      await record(subject, "error", {
        model: NICHE_MODEL,
        usage: { inputTokens: 0, outputTokens: 0 },
        attempts: 0,
        costUsd: null,
        durationMs: Date.now() - startedJob,
      })
      return null
    }
  }

  async function record(subject: string, status: UsageStatus, stats: GenerationStats) {
    if (!deps.usage) return
    try {
      await deps.usage.record({
        purpose: "trend-refresh",
        subject,
        model: stats.model,
        status,
        inputTokens: stats.usage.inputTokens,
        outputTokens: stats.usage.outputTokens,
        attempts: stats.attempts,
        costUsd: stats.costUsd,
        durationMs: stats.durationMs,
      })
    } catch (error) {
      logger.error("usage.record.error", { subject, error: errorMessage(error) })
    }
  }

  // 3. Optional paid research with Claude's web search tool.
  if (deps.webResearch) {
    const researcher = deps.webResearch
    const found = await runJob("web-research", researcher.estimateUsd, async () => {
      const { signals, stats } = await researcher.run()
      return { value: signals, status: "ok", stats }
    })
    if (found) raw.push(found)
  }
  report.signals = mergeSignals(raw)

  // 4. Propose new niches from the evidence.
  const existing = [...deps.seeds, ...(await store.listExisting())]
  if (report.signals.length >= MIN_SIGNALS) {
    const proposals = await runJob("trend-proposals", COST_ESTIMATES.proposal, async () => {
      const { decisions, stats } = await proposeTrends(report.signals, existing, { llm })
      return { value: decisions, status: "ok", stats }
    })
    report.proposals = proposals ?? []
  } else {
    report.failures.push(`only ${report.signals.length} signals gathered; skipped proposals`)
  }

  // 5. Generate and publish accepted proposals.
  const accepted = report.proposals.filter((decision) => decision.accepted).slice(0, config.maxNew)
  await mapWithConcurrency(accepted, GENERATION_CONCURRENCY, async (decision) => {
    const profile = await runJob(decision.slug, COST_ESTIMATES.generation, () =>
      generateProfile(llm, decision.name, decision.slug),
    )
    if (!profile) return
    // The generated name can drift; re-check overlap before publishing.
    const overlap = findOverlap({ slug: profile.slug, name: profile.name }, existing)
    if (overlap && !overlap.startsWith("already exists")) {
      report.failures.push(`${decision.slug}: ${overlap}`)
      return
    }
    const inserted = await store.insertTrending({
      profile,
      sources: decision.sources,
      trendScore: decision.trendScore,
      model: NICHE_MODEL,
      inputTokens: 0,
      outputTokens: 0,
      publishedAt: now,
      expiresAt: addDays(now, config.ttlDays),
    })
    if (inserted) report.created.push(profile.slug)
    else report.failures.push(`${profile.slug}: already exists`)
  })

  // 6. Keep active trends fresh (stable slug and name; content regenerated).
  for (const candidate of candidates) {
    const profile = await runJob(`refresh:${candidate.slug}`, COST_ESTIMATES.generation, () =>
      generateProfile(llm, candidate.name, candidate.slug),
    )
    if (!profile) continue
    await store.updateProfile(candidate.slug, { ...profile, name: candidate.name }, now)
    report.refreshed.push(candidate.slug)
  }

  logger.info("trends.refresh", {
    created: report.created,
    refreshed: report.refreshed,
    archived: report.archived,
    spentUsd: budget.committedUsd(),
    abortedReason: report.abortedReason,
  })
  return finish()
}

async function generateProfile(
  llm: LlmClient,
  name: string,
  slug: string,
): Promise<JobOutcome<NicheProfile>> {
  const result = await generateNicheProfile({ name, slug }, { llm })
  return {
    value: result.status === "ok" ? result.profile : null,
    status: result.status,
    stats: result.stats,
  }
}
