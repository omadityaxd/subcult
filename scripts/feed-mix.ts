/**
 * pnpm feeds:mix [slug …]
 *
 * Builds each niche's For You stream from the cached feeds (the shared Redis
 * breaker keeps a rate-limited Spotify untouched) and prints the measured
 * content mix next to the target shares.
 */
import { Redis } from "@upstash/redis"
import { buildNicheFeed } from "../src/lib/feed/feed"
import { buildForYou, nicheMix } from "../src/lib/feed/for-you"
import { MIX_KINDS, measureMix } from "../src/lib/feed/mix"
import { nicheRelevance } from "../src/lib/feed/niche-relevance"
import { createFeedDeps } from "../src/lib/feed/server"
import { log } from "../src/lib/log"
import { type SoundtrackTrack, soundtrackFeedItems } from "../src/lib/music/soundtrack"
import { artistSpotifyId, findSeedProfile } from "../src/lib/niches/catalog"
import { loadLocalEnv } from "./load-env"

const pct = (value: number) => `${Math.round(value * 100)}%`.padStart(4)

async function main(): Promise<void> {
  loadLocalEnv()
  const slugs = process.argv.slice(2)
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = process.env
  const redis = url && token ? new Redis({ url, token }) : null
  const deps = createFeedDeps({
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    youtubeApiKey: process.env.YOUTUBE_API_KEY,
    artistIdFor: artistSpotifyId,
    youtubeRelevance: nicheRelevance,
    redis,
    logger: { info: () => undefined, warn: () => undefined, error: log.error },
  })
  console.log(`kind        ${MIX_KINDS.map((k) => k.padEnd(9)).join("")}`)
  for (const slug of slugs.length > 0 ? slugs : ["rage", "vamp", "deftones-core"]) {
    const profile = findSeedProfile(slug)
    if (!profile) continue
    // Soundtracks come from the same Redis cache the app fills.
    const soundtrack = redis
      ? ((await redis.get(`subcult:soundtrack:v1:${slug}`)) as { value?: SoundtrackTrack[] } | null)
      : null
    const music = soundtrackFeedItems({ slug, title: slug, tracks: soundtrack?.value ?? [] })
    const items = buildForYou(slug, await buildNicheFeed(profile, deps), { music }, 50)
    const target = nicheMix(slug)
    const measured = measureMix(items)
    console.log(`\n${slug} (${items.length} items)`)
    console.log(`  target    ${MIX_KINDS.map((k) => pct(target[k]).padEnd(9)).join("")}`)
    console.log(`  measured  ${MIX_KINDS.map((k) => pct(measured[k]).padEnd(9)).join("")}`)
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
