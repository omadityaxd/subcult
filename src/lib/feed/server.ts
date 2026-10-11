import type { Redis } from "@upstash/redis"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import type { Logger } from "@/lib/log"
import { memoryStore, redisStore } from "./cache"
import type { FeedDeps } from "./feed"
import { newsFetcher } from "./fetchers/news"
import { redisBreaker } from "@/lib/sources/redis-breaker"
import { memoryBreaker } from "@/lib/sources/spotify"
import { spotifyFetcher } from "./fetchers/spotify"
import { type YoutubeRelevance, youtubeFetcher } from "./fetchers/youtube"
import { memoryQuota, redisQuota } from "./quota"
import type { FeedSource, Fetcher } from "./types"

/**
 * 80 searches × 100 units = 8,000 of YouTube's 10,000 daily units, leaving
 * headroom for the trend engine's searches.
 */
export const DEFAULT_YOUTUBE_DAILY_SEARCHES = 80

export interface FeedSettings {
  spotifyClientId?: string
  spotifyClientSecret?: string
  youtubeApiKey?: string
  youtubeDailySearches?: number
  /** Verified Spotify artist IDs from the taxonomy, so artist tracks are exact. */
  artistIdFor?: (name: string) => string | undefined
  /** Verified artists + entity/phrase terms that a video must match to be kept. */
  youtubeRelevance?: (profile: NicheProfile) => YoutubeRelevance
  /** The niche's relevance pipeline (spam, language, negatives, source tiers, dedupe). */
  cleanContext?: FeedDeps["cleanContext"]
  /** null → per-process memory cache and quota (dev / demo). */
  redis: Redis | null
  logger: Logger
}

// Module-level so the in-memory fallbacks persist across requests in one process.
const localCache = memoryStore()
const localYoutubeQuota = memoryQuota(DEFAULT_YOUTUBE_DAILY_SEARCHES)
const localSpotifyBreaker = memoryBreaker()

/** Shared with lib/music so a 429 anywhere pauses every Spotify caller. */
export const SPOTIFY_BREAKER_KEY = "subcult:spotify:blocked-until"

/**
 * Builds fetchers from whatever keys exist. Missing keys disable that source
 * (reported as "disabled"), never crash: Google News needs no key at all.
 */
export function createFeedDeps(settings: FeedSettings): FeedDeps {
  const fetchers: Fetcher[] = [newsFetcher()]
  const disabled: FeedSource[] = []

  if (settings.spotifyClientId && settings.spotifyClientSecret) {
    fetchers.push(
      spotifyFetcher({
        clientId: settings.spotifyClientId,
        clientSecret: settings.spotifyClientSecret,
        artistIdFor: settings.artistIdFor,
        breaker: settings.redis
          ? redisBreaker(settings.redis, SPOTIFY_BREAKER_KEY)
          : localSpotifyBreaker,
      }),
    )
  } else {
    disabled.push("spotify")
  }

  if (settings.youtubeApiKey) {
    const perDay = settings.youtubeDailySearches ?? DEFAULT_YOUTUBE_DAILY_SEARCHES
    const quota = settings.redis
      ? redisQuota(settings.redis, "yt:searches", perDay)
      : localYoutubeQuota
    fetchers.push(youtubeFetcher(settings.youtubeApiKey, quota, fetch, settings.youtubeRelevance))
  } else {
    disabled.push("youtube")
  }

  return {
    fetchers,
    disabled,
    cache: settings.redis ? redisStore(settings.redis) : localCache,
    logger: settings.logger,
    cleanContext: settings.cleanContext,
  }
}
