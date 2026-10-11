import type { NicheProfile } from "@/lib/engine/profile-schema"
import { fetchGoogleNews } from "@/lib/sources/google-news"
import type { FeedItem, Fetcher } from "../types"

const QUERIES_USED = 2
const LOOKBACK_DAYS = 14
const MAX_ITEMS = 12

/** Small stable hash for ids (Google News URLs are long opaque redirects). */
export function hashString(value: string): string {
  let hash = 5381
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0
  return (hash >>> 0).toString(36)
}

/** Google News RSS: keyless, so the Tea tab always has something live. */
export function newsFetcher(fetchImpl: typeof fetch = fetch): Fetcher {
  return {
    source: "news",
    freshSeconds: 3600,
    staleSeconds: 24 * 3600,
    // d1: items carry the publisher domain (meta.domain) for source allowlists.
    cacheVersion: "d1",
    async fetch(profile: NicheProfile) {
      const settled = await Promise.allSettled(
        profile.newsQueries
          .slice(0, QUERIES_USED)
          .map((query) => fetchGoogleNews(query, { days: LOOKBACK_DAYS, fetchImpl })),
      )
      const failures = settled.filter((r) => r.status === "rejected")
      if (failures.length === settled.length && failures[0]?.status === "rejected") {
        throw failures[0].reason
      }
      const seen = new Set<string>()
      return settled
        .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
        .filter((article) => !seen.has(article.title) && seen.add(article.title))
        .slice(0, MAX_ITEMS)
        .map((article): FeedItem => ({
          id: `news:article:${hashString(article.url)}`,
          source: "news",
          type: "article",
          title: article.title,
          subtitle: article.outlet,
          imageUrl: null,
          url: article.url,
          publishedAt: article.publishedAt?.toISOString() ?? null,
          score: 0,
          meta: { outlet: article.outlet, domain: article.domain },
        }))
    },
  }
}
