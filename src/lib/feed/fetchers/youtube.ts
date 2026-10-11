import type { NicheProfile } from "@/lib/engine/profile-schema"
import { addDays } from "@/lib/niches/lifecycle"
import { searchYoutube } from "@/lib/sources/youtube"
import { QuotaExhaustedError, type QuotaGuard } from "../quota"
import { type RelevanceTerms, isRelevant } from "../relevance"
import type { FeedItem, Fetcher } from "../types"

const LOOKBACK_DAYS = 120 // ranking decay favors fresh videos; the window just has to be wide enough
/** Same 100-unit cost at any size, so ask for headroom: the relevance filter drops some. */
const MAX_RESULTS = 15
const KEEP = 8
const QUERY_ARTISTS = 3

export interface YoutubeRelevance {
  terms: RelevanceTerms
  /** Verified artist names, lead first: searched instead of the niche name. */
  artists: readonly string[]
}

/** `"Ken Carson" | "Che" | "OsamaSon"`: YouTube's OR syntax, exact names. */
export function artistQuery(artists: readonly string[]): string | null {
  const picked = artists.slice(0, QUERY_ARTISTS)
  return picked.length > 0 ? picked.map((name) => `"${name}"`).join(" | ") : null
}

/**
 * YouTube Data API v3. Each search costs 100 of the 10,000 daily units, so
 * one search per niche per refresh, gated by a shared daily budget. When the
 * budget is spent the fetcher throws and the cache serves the stale copy.
 */
export function youtubeFetcher(
  apiKey: string,
  quota: QuotaGuard,
  fetchImpl: typeof fetch = fetch,
  relevanceFor?: (profile: NicheProfile) => YoutubeRelevance,
): Fetcher {
  return {
    source: "youtube",
    freshSeconds: 6 * 3600,
    staleSeconds: 3 * 24 * 3600,
    // r3: US/English, artist queries, relevance-filtered (old cached results had regional junk).
    cacheVersion: "r3",
    async fetch(profile: NicheProfile) {
      if (!(await quota.tryConsume())) throw new QuotaExhaustedError("youtube")
      const relevance = relevanceFor?.(profile)
      const query =
        (relevance && artistQuery(relevance.artists)) ?? profile.youtubeQueries[0] ?? profile.name
      const videos = await searchYoutube(query, {
        apiKey,
        publishedAfter: addDays(new Date(), -LOOKBACK_DAYS),
        // Relevance within a recent window beats pure "date", which surfaces spam uploads.
        order: "relevance",
        videoDuration: "medium",
        regionCode: "US",
        relevanceLanguage: "en",
        maxResults: MAX_RESULTS,
        fetchImpl,
      })
      const kept = relevance
        ? videos.filter((video) =>
            isRelevant({ title: video.title, channel: video.channel }, relevance.terms),
          )
        : videos
      return kept.slice(0, KEEP).map((video): FeedItem => ({
        id: `youtube:video:${video.id}`,
        source: "youtube",
        type: "video",
        title: video.title,
        subtitle: video.channel,
        imageUrl: video.thumbnailUrl,
        url: video.url,
        publishedAt: video.publishedAt?.toISOString() ?? null,
        score: 0,
        meta: {
          channel: video.channel,
          embedUrl: `https://www.youtube-nocookie.com/embed/${video.id}`,
        },
      }))
    },
  }
}
