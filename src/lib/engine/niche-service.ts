import { isExcludedTopic } from "@/lib/feed/excluded"
import { type Logger, errorMessage } from "@/lib/log"
import type { NicheKind, NicheStatus, TrendSource } from "@/lib/niches/lifecycle"
import type { GenerationResult } from "./generate"
import type { NicheProfile } from "./profile-schema"
import { parseNicheInput } from "./slug"
import { type UsageEntry, type UsageLog, usageFromStats } from "./usage"

export const GENERATED_BY = ["seed", "user", "anon", "trend"] as const
export type GeneratedBy = (typeof GENERATED_BY)[number]

export interface StoredNiche {
  slug: string
  name: string
  profile: NicheProfile
  generatedBy: GeneratedBy
  createdAt: Date
  kind: NicheKind
  status: NicheStatus
  trendScore: number | null
  sources: TrendSource[]
  publishedAt: Date
  expiresAt: Date | null
}

export interface NewNiche {
  profile: NicheProfile
  generatedBy: GeneratedBy
  model: string
  inputTokens: number
  outputTokens: number
}

export interface NicheRepository {
  findBySlug(slug: string): Promise<StoredNiche | null>
  /** Inserts unless the slug already exists; always returns the stored row. */
  insert(niche: NewNiche): Promise<StoredNiche>
  listSlugs(): Promise<string[]>
}

export type NicheGenerator = (niche: { name: string; slug: string }) => Promise<GenerationResult>

export type NicheLookup =
  | { status: "found"; niche: StoredNiche; source: "cache" | "generated" }
  | { status: "invalid-input"; reason: string }
  | { status: "rejected"; reason: string }
  | { status: "rate-limited"; reason: string }
  | { status: "capped"; reason: string }
  | { status: "unavailable"; reason: string }
  | { status: "failed"; reason: string }

/** Budget decision before spending tokens: per-identifier limit vs global daily cap. */
export type GenerationPermit = "ok" | "rate-limited" | "capped"

export interface NicheServiceDeps {
  repo: NicheRepository
  /** null when no LLM is configured: cached niches still resolve. */
  generate: NicheGenerator | null
  logger: Logger
  /** Token ledger; optional so the engine runs without a usage table (tests, scripts). */
  usage?: UsageLog
}

export interface GetOrCreateOptions {
  generatedBy: GeneratedBy
  /** Consulted only on a cache miss, right before spending tokens. */
  checkBudget?: () => Promise<GenerationPermit>
}

const PERMIT_DENIALS = {
  "rate-limited": "you've summoned a lot of niches today. come back tomorrow.",
  capped: "the vibe machine is resting. try a preset niche while it recharges",
} as const

export interface NicheService {
  getOrCreate(rawName: unknown, options: GetOrCreateOptions): Promise<NicheLookup>
}

/**
 * Cache-first niche resolution: Postgres is the cache and the LLM runs at most
 * once per slug. Concurrent requests for the same new slug share one generation.
 */
export function createNicheService({
  repo,
  generate,
  logger,
  usage,
}: NicheServiceDeps): NicheService {
  const inFlight = new Map<string, Promise<NicheLookup>>()

  /** Ledger writes must never break a user request; failures are logged, not thrown. */
  async function recordUsage(entry: UsageEntry): Promise<void> {
    if (!usage) return
    try {
      await usage.record(entry)
    } catch (error) {
      logger.error("usage.record.error", { subject: entry.subject, error: errorMessage(error) })
    }
  }

  async function generateAndStore(
    niche: { name: string; slug: string },
    { generatedBy, checkBudget }: GetOrCreateOptions,
  ): Promise<NicheLookup> {
    if (!generate) {
      return { status: "unavailable", reason: "new niches are coming soon. try one from explore!" }
    }
    // Some corners of the internet we don't make pages for (rating faces, PEDs, blackpill).
    if (isExcludedTopic(niche.name)) {
      return {
        status: "rejected",
        reason: "we don't do that corner of the internet. try softmaxxing for the healthy glow-up?",
      }
    }
    const permit = checkBudget ? await checkBudget() : "ok"
    if (permit !== "ok") return { status: permit, reason: PERMIT_DENIALS[permit] }

    const startedAt = Date.now()
    let result: GenerationResult
    try {
      result = await generate(niche)
    } catch (error) {
      logger.error("niche.generate.error", { slug: niche.slug, error: errorMessage(error) })
      await recordUsage({
        purpose: "niche-generation",
        subject: niche.slug,
        model: "unknown",
        status: "error",
        inputTokens: 0,
        outputTokens: 0,
        attempts: 0,
        costUsd: 0,
        durationMs: Date.now() - startedAt,
      })
      return { status: "failed", reason: "the vibe machine hiccuped. try again in a sec" }
    }

    const { stats } = result
    await recordUsage(usageFromStats("niche-generation", niche.slug, result.status, stats))
    logger.info("niche.generate", {
      slug: niche.slug,
      status: result.status,
      generatedBy,
      model: stats.model,
      inputTokens: stats.usage.inputTokens,
      outputTokens: stats.usage.outputTokens,
      attempts: stats.attempts,
      costUsd: stats.costUsd,
      durationMs: stats.durationMs,
    })

    if (result.status === "rejected") return { status: "rejected", reason: result.reason }
    if (result.status === "invalid") {
      logger.warn("niche.generate.invalid", { slug: niche.slug, issues: result.issues })
      return { status: "failed", reason: "we couldn't pin that vibe down. try rephrasing?" }
    }

    const stored = await repo.insert({
      profile: result.profile,
      generatedBy,
      model: stats.model,
      inputTokens: stats.usage.inputTokens,
      outputTokens: stats.usage.outputTokens,
    })
    return { status: "found", niche: stored, source: "generated" }
  }

  return {
    async getOrCreate(rawName, options) {
      const input = parseNicheInput(rawName)
      if (!input.ok) return { status: "invalid-input", reason: input.reason }

      const cached = await repo.findBySlug(input.slug)
      if (cached) return { status: "found", niche: cached, source: "cache" }

      const pending = inFlight.get(input.slug)
      if (pending) return pending

      const work = generateAndStore(input, options).finally(() => inFlight.delete(input.slug))
      inFlight.set(input.slug, work)
      return work
    },
  }
}
