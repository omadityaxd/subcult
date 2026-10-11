/**
 * pnpm feeds:mix [slug …]
 *
 * Builds For You (the home feed: featured niches, a page each) and each
 * niche's own stream from the cached feeds, soundtracks and moodboards (the
 * shared Redis breaker keeps a rate-limited Spotify untouched), then prints
 * the measured content mix next to the target shares.
 */
import { Redis } from "@upstash/redis"
import { buildNicheFeed } from "../src/lib/feed/feed"
import { featuredOrder } from "../src/lib/feed/featured"
import { buildForYou, nicheMix } from "../src/lib/feed/for-you"
import { DEFAULT_MIX, MIX_KINDS, type MixShares, measureMix } from "../src/lib/feed/mix"
import { nicheCleanContext, nicheRelevance } from "../src/lib/feed/niche-relevance"
import { createFeedDeps } from "../src/lib/feed/server"
import type { FeedItem } from "../src/lib/feed/types"
import { log } from "../src/lib/log"
import { moodboardFeedItems } from "../src/lib/moodboard/board"
import type { Moodboard } from "../src/lib/moodboard/types"
import { type SoundtrackTrack, soundtrackFeedItems } from "../src/lib/music/soundtrack"
import { artistSpotifyId, findSeedProfile } from "../src/lib/niches/catalog"
import { loadLocalEnv } from "./load-env"

const NICHE_ITEMS = 50
const HOME_PAGE = 8
const FOR_YOU_ITEMS = 50

const pct = (value: number) => `${Math.round(value * 100)}%`.padStart(4)
const row = (label: string, shares: MixShares) =>
  `  ${label.padEnd(9)} ${MIX_KINDS.map((k) => pct(shares[k]).padEnd(10)).join("")}`

async function main(): Promise<void> {
  loadLocalEnv()
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = process.env
  const redis = url && token ? new Redis({ url, token }) : null
  const deps = createFeedDeps({
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    youtubeApiKey: process.env.YOUTUBE_API_KEY,
    artistIdFor: artistSpotifyId,
    youtubeRelevance: nicheRelevance,
    cleanContext: nicheCleanContext,
    redis,
    logger: { info: () => undefined, warn: () => undefined, error: log.error },
  })

  async function nicheItems(slug: string, limit: number): Promise<FeedItem[]> {
    const profile = findSeedProfile(slug)
    if (!profile) return []
    // Soundtracks and moodboards come from the same Redis cache the app fills.
    const [soundtrack, board] = redis
      ? await Promise.all([
          redis.get<{ value?: SoundtrackTrack[] }>(`subcult:soundtrack:v1:${slug}`),
          redis.get<{ value?: Moodboard }>(`subcult:moodboard:v1:${slug}`),
        ])
      : [null, null]
    const music = soundtrackFeedItems({ slug, title: slug, tracks: soundtrack?.value ?? [] })
    const pins = moodboardFeedItems(board?.value?.pins ?? [])
    return buildForYou(slug, await buildNicheFeed(profile, deps), { music, moodboard: pins }, limit)
  }

  console.log(`kind        ${MIX_KINDS.map((k) => k.padEnd(10)).join("")}`)

  const home: FeedItem[] = []
  for (const niche of featuredOrder(new Date())) {
    if (home.length >= FOR_YOU_ITEMS) break
    home.push(...(await nicheItems(niche.slug, HOME_PAGE)))
  }
  const forYou = home.slice(0, FOR_YOU_ITEMS)
  console.log(`\nFor You (${forYou.length} items)`)
  console.log(row("target", DEFAULT_MIX))
  console.log(row("measured", measureMix(forYou)))

  for (const slug of process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : ["rage", "vamp", "deftones-core"]) {
    const items = await nicheItems(slug, NICHE_ITEMS)
    console.log(`\n${slug} (${items.length} items)`)
    console.log(row("target", nicheMix(slug)))
    console.log(row("measured", measureMix(items)))
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
