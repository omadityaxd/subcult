import "server-only"
import { env } from "@/lib/env"
import { log } from "@/lib/log"
import { TAXONOMY, artistSpotifyId, nicheArtistsLeadFirst } from "@/lib/niches/catalog"
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
    fitCheckTerms: (profile) => {
      const brands = TAXONOMY.brandsOf(profile.slug).map((brand) => brand.name)
      const artists = TAXONOMY.curation(profile.slug)?.soundtrackOnly
        ? []
        : nicheArtistsLeadFirst(profile.slug).map((artist) => artist.name)
      return { names: [...brands.slice(0, 1), ...artists.slice(0, 1)] }
    },
    cleanContext: nicheCleanContext,
    redis: getRedis(),
    logger: log,
  })
}
