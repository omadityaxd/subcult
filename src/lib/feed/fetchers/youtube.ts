import type { NicheProfile } from "@/lib/engine/profile-schema"
import { addDays } from "@/lib/niches/lifecycle"
import { searchYoutube } from "@/lib/sources/youtube"
import { QuotaExhaustedError, type QuotaGuard } from "../quota"
import type { FeedItem, Fetcher } from "../types"

const LOOKBACK_DAYS = 120 // ranking decay favors fresh videos; the window just has to be wide enough
const MAX_RESULTS = 8

/**
 * YouTube Data API v3. Each search costs 100 of the 10,000 daily units, so
 * one search per niche per refresh, gated by a shared daily budget. When the
 * budget is spent the fetcher throws and the cache serves the stale copy.
 */
export function youtubeFetcher(
  apiKey: string,
  quota: QuotaGuard,
  fetchImpl: typeof fetch = fetch,
): Fetcher {
  return {
    source: "youtube",
    freshSeconds: 6 * 3600,
    staleSeconds: 3 * 24 * 3600,
    async fetch(profile: NicheProfile) {
      if (!(await quota.tryConsume())) throw new QuotaExhaustedError("youtube")
      const query = profile.youtubeQueries[0] ?? profile.name
      const videos = await searchYoutube(query, {
        apiKey,
        publishedAfter: addDays(new Date(), -LOOKBACK_DAYS),
        // Relevance within a recent window beats pure "date", which surfaces spam uploads.
        order: "relevance",
        videoDuration: "medium",
        maxResults: MAX_RESULTS,
        fetchImpl,
      })
      return videos.map((video): FeedItem => ({
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
