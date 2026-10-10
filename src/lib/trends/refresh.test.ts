import type Anthropic from "@anthropic-ai/sdk"
import { describe, expect, it, vi } from "vitest"
import type { LlmClient } from "@/lib/engine/generate"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { fakeMessage, makeDraft, okJson } from "@/lib/engine/test-fixtures"
import type { UsageLog } from "@/lib/engine/usage"
import type { Logger } from "@/lib/log"
import { TREND_SYSTEM_PROMPT } from "./propose"
import { runTrendRefresh } from "./refresh"
import type { NewTrendingNiche, RawSignal, SignalSource, TrendStore } from "./types"

const logger: Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
const NOW = new Date("2026-10-15T09:00:00Z")

function memoryStore(overrides: Partial<TrendStore> = {}) {
  const inserted: NewTrendingNiche[] = []
  const updated: { slug: string; profile: NicheProfile }[] = []
  const store: TrendStore = {
    listExisting: async () => [],
    findExpired: async () => ["old-trend"],
    archiveExpired: vi.fn(async () => ["old-trend"]),
    listRefreshCandidates: async () => [],
    insertTrending: async (niche) => {
      inserted.push(niche)
      return true
    },
    updateProfile: async (slug, profile) => {
      updated.push({ slug, profile })
    },
    ...overrides,
  }
  return { store, inserted, updated }
}

const rawSignals: RawSignal[] = Array.from({ length: 5 }, (_, i) => ({
  kind: "news",
  title: `office siren headline ${i}`,
  url: `https://news.example/${i}`,
  outlet: "Example",
  publishedAt: new Date(NOW.getTime() - i * 86_400_000),
}))
const newsSource: SignalSource = { name: "news", gather: async () => rawSignals }

/** Proposal calls get a proposal; generation calls get a valid profile. */
function scriptedLlm(proposals: unknown[]): LlmClient & { calls: number } {
  const llm = {
    calls: 0,
    async createMessage(params: Anthropic.MessageCreateParamsNonStreaming) {
      llm.calls++
      if (params.system === TREND_SYSTEM_PROMPT) {
        return fakeMessage(JSON.stringify({ proposals }))
      }
      return fakeMessage(okJson(makeDraft({ name: "office siren" })))
    },
  }
  return llm
}

const officeSiren = {
  name: "office siren",
  whyNow: "corporate-core fits are everywhere",
  trendScore: 80,
  sourceIds: ["s1", "s2", "s3"],
}

describe("runTrendRefresh", () => {
  it("publishes evidenced proposals as trending niches with sources and expiry", async () => {
    const { store, inserted } = memoryStore()
    const usage: UsageLog = {
      record: vi.fn(async () => undefined),
      countSince: vi.fn(),
      costSince: vi.fn(),
    }

    const report = await runTrendRefresh({
      store,
      seeds: [],
      signalSources: [newsSource],
      llm: scriptedLlm([officeSiren]),
      usage,
      logger,
      now: () => NOW,
    })

    expect(report.created).toEqual(["office-siren"])
    expect(report.archived).toEqual(["old-trend"])
    expect(inserted[0].sources).toHaveLength(3)
    expect(inserted[0].expiresAt.toISOString()).toBe("2026-11-26T09:00:00.000Z")
    expect(usage.record).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: "trend-refresh", subject: "trend-proposals" }),
    )
    expect(report.spentUsd).toBeGreaterThan(0)
    expect(report.spentUsd).toBeLessThanOrEqual(report.maxCostUsd)
  })

  it("aborts before exceeding the cost cap", async () => {
    const { store, inserted } = memoryStore()
    const llm = scriptedLlm([officeSiren])

    const report = await runTrendRefresh({
      store,
      seeds: [],
      signalSources: [newsSource],
      llm,
      logger,
      now: () => NOW,
      config: { maxCostUsd: 0.001 },
    })

    expect(report.abortedReason).toMatch(/cost cap/)
    expect(llm.calls).toBe(0)
    expect(inserted).toEqual([])
  })

  it("skips duplicates of existing niches", async () => {
    const { store, inserted } = memoryStore()
    const report = await runTrendRefresh({
      store,
      seeds: [{ slug: "office-siren", name: "office siren", relatedNiches: [] }],
      signalSources: [newsSource],
      llm: scriptedLlm([officeSiren]),
      logger,
      now: () => NOW,
    })
    expect(report.proposals[0].accepted).toBe(false)
    expect(inserted).toEqual([])
  })

  it("refreshes stale trending niches but keeps their name", async () => {
    const { store, updated } = memoryStore({
      listRefreshCandidates: async () => [{ slug: "mermaidcore", name: "mermaidcore" }],
    })
    const report = await runTrendRefresh({
      store,
      seeds: [],
      signalSources: [newsSource],
      llm: scriptedLlm([]),
      logger,
      now: () => NOW,
    })
    expect(report.refreshed).toEqual(["mermaidcore"])
    expect(updated[0].profile.name).toBe("mermaidcore")
  })

  it("no-ops cleanly without an API key (archive only)", async () => {
    const { store } = memoryStore()
    const gather = vi.fn(async () => rawSignals)
    const report = await runTrendRefresh({
      store,
      seeds: [],
      signalSources: [{ name: "news", gather }],
      llm: null,
      logger,
      now: () => NOW,
    })
    expect(report.skippedReason).toMatch(/ANTHROPIC_API_KEY/)
    expect(report.archived).toEqual(["old-trend"])
    expect(gather).not.toHaveBeenCalled()
  })

  it("dry run gathers signals but makes no LLM calls or writes", async () => {
    const { store, inserted } = memoryStore()
    const llm = scriptedLlm([officeSiren])
    const report = await runTrendRefresh(
      { store, seeds: [], signalSources: [newsSource], llm, logger, now: () => NOW },
      { dryRun: true },
    )
    expect(report.signals).toHaveLength(5)
    expect(llm.calls).toBe(0)
    expect(store.archiveExpired).not.toHaveBeenCalled()
    expect(inserted).toEqual([])
  })
})
