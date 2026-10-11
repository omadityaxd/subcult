import "server-only"
import { env } from "@/lib/env"
import { log } from "@/lib/log"
import { artistSpotifyId } from "@/lib/niches/catalog"
import { getRedis } from "@/lib/redis"
import type { FeedDeps } from "./feed"
import { nicheCleanContext, nicheRelevance } from "./niche-relevance"
import { createFeedDeps } from "./server"

/** Feed dependencies wired from the app's env, Redis and verified artist IDs. */
export function appFeedDeps(): FeedDeps {
  return createFeedDeps({
    spotifyClientId: env.SPOTIFY_CLIENT_ID,
    spotifyClientSecret: env.SPOTIFY_CLIENT_SECRET,
    youtubeApiKey: env.YOUTUBE_API_KEY,
    artistIdFor: artistSpotifyId,
    youtubeRelevance: nicheRelevance,
    cleanContext: nicheCleanContext,
    redis: getRedis(),
    logger: log,
  })
}
