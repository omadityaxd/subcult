import "server-only"
import { env } from "@/lib/env"
import { log } from "@/lib/log"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { TAXONOMY, artistSpotifyId, nicheArtistsLeadFirst } from "@/lib/niches/catalog"
import type { YoutubeRelevance } from "./fetchers/youtube"
import { phrasesOnly } from "./relevance"
import { getRedis } from "@/lib/redis"
import type { FeedDeps } from "./feed"
import { createFeedDeps } from "./server"

/** Feed dependencies wired from the app's env, Redis and verified artist IDs. */
export function appFeedDeps(): FeedDeps {
  return createFeedDeps({
    spotifyClientId: env.SPOTIFY_CLIENT_ID,
    spotifyClientSecret: env.SPOTIFY_CLIENT_SECRET,
    youtubeApiKey: env.YOUTUBE_API_KEY,
    artistIdFor: artistSpotifyId,
    youtubeRelevance: nicheRelevance,
    redis: getRedis(),
    logger: log,
  })
}

/**
 * What counts as evidence for a niche: its verified artists (and aliases),
 * brands and collectives, plus multi-word versions of its name and aliases.
 */
export function nicheRelevance(profile: NicheProfile): YoutubeRelevance {
  const artists = nicheArtistsLeadFirst(profile.slug)
  const curation = TAXONOMY.curation(profile.slug)
  return {
    artists: artists.map((artist) => artist.name),
    terms: {
      entities: [
        ...artists.flatMap((artist) => [artist.name, ...artist.aliases]),
        ...TAXONOMY.brandsOf(profile.slug).map((brand) => brand.name),
        ...TAXONOMY.communitiesOf(profile.slug).flatMap((c) => [c.name, ...c.aliases]),
      ],
      phrases: phrasesOnly([profile.name, ...(curation?.aliases ?? [])]),
    },
  }
}
