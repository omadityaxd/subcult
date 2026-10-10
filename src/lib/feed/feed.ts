import { withTimeout } from "@/lib/concurrency"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { type Logger, errorMessage } from "@/lib/log"
import { type CacheState, type CacheStore, cached } from "./cache"
import { interleave, nicheKeywords, rankFeed } from "./rank"
import type { FeedItem, FeedSource, Fetcher } from "./types"

/** Per-fetcher budget: a slow source is dropped, never waited on. */
export const FETCHER_TIMEOUT_MS = 4_000
const CACHE_VERSION = "v3" // bump when fetcher output changes (v3: artist tracks, no Shorts, artist subtitle)

export type SourceState = "ok" | "stale" | "disabled" | "error"

export interface SourceStatus {
  source: FeedSource
  state: SourceState
  count: number
  cache: CacheState | null
  error?: string
}

export interface NicheFeed {
  /** Ranked and interleaved across sources: the For You feed. */
  items: FeedItem[]
  /** Per-source lists (ranked) for the Sounds / Tea / Watch tabs. */
  bySource: Partial<Record<FeedSource, FeedItem[]>>
  statuses: SourceStatus[]
  /** When this feed was assembled (epoch ms); render relative ages against it. */
  generatedAt: number
}

export interface FeedDeps {
  fetchers: readonly Fetcher[]
  /** Sources skipped because their keys are missing; reported, never fetched. */
  disabled: readonly FeedSource[]
  cache: CacheStore
  logger: Logger
  now?: () => Date
  timeoutMs?: number
  feedback?: ReadonlyMap<string, number>
}

export const feedCacheKey = (source: FeedSource, slug: string) =>
  `subcult:feed:${CACHE_VERSION}:${source}:${slug}`

/**
 * Fan out to every enabled fetcher in parallel (Promise.allSettled), each
 * behind the cache and a timeout. One failing source never breaks the feed.
 */
export async function buildNicheFeed(profile: NicheProfile, deps: FeedDeps): Promise<NicheFeed> {
  const now = deps.now?.() ?? new Date()
  const timeoutMs = deps.timeoutMs ?? FETCHER_TIMEOUT_MS

  const settled = await Promise.allSettled(
    deps.fetchers.map((fetcher) =>
      cached(
        deps.cache,
        feedCacheKey(fetcher.source, profile.slug),
        { freshSeconds: fetcher.freshSeconds, staleSeconds: fetcher.staleSeconds },
        () => withTimeout(fetcher.fetch(profile), timeoutMs, fetcher.source),
        {
          onStoreError: (operation, error) =>
            deps.logger.warn("feed.cache.error", { operation, error: errorMessage(error) }),
        },
      ),
    ),
  )

  const statuses: SourceStatus[] = deps.disabled.map((source) => ({
    source,
    state: "disabled",
    count: 0,
    cache: null,
  }))
  const collected: FeedItem[] = []

  settled.forEach((result, index) => {
    const { source } = deps.fetchers[index]
    if (result.status === "rejected") {
      const error = errorMessage(result.reason)
      deps.logger.warn("feed.fetcher.error", { source, slug: profile.slug, error })
      statuses.push({ source, state: "error", count: 0, cache: null, error })
      return
    }
    const { value, state } = result.value
    collected.push(...value)
    statuses.push({
      source,
      state: state === "stale" ? "stale" : "ok",
      count: value.length,
      cache: state,
    })
  })

  const ranked = rankFeed(collected, {
    keywords: nicheKeywords(profile),
    now,
    feedback: deps.feedback,
  })
  const bySource: NicheFeed["bySource"] = {}
  for (const item of ranked) (bySource[item.source] ??= []).push(item)

  return { items: interleave(ranked), bySource, statuses, generatedAt: now.getTime() }
}
