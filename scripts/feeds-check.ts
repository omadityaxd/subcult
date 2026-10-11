/**
 * pnpm feeds:check [slug] [--no-cache]
 *
 * Hits every configured source live for one niche and prints what came back,
 * then builds the full ranked feed twice to show the Redis cache working.
 * Missing keys show up as "disabled" instead of failing.
 */
import { Redis } from "@upstash/redis"
import { memoryStore } from "../src/lib/feed/cache"
import { buildNicheFeed } from "../src/lib/feed/feed"
import { createFeedDeps } from "../src/lib/feed/server"
import { errorMessage, log } from "../src/lib/log"
import { nicheCleanContext, nicheRelevance } from "../src/lib/feed/niche-relevance"
import { artistSpotifyId, findSeedProfile } from "../src/lib/niches/catalog"
import { loadLocalEnv } from "./load-env"

async function main(): Promise<void> {
  loadLocalEnv()
  const slug = process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? "gorpcore"
  const noCache = process.argv.includes("--no-cache")
  const profile = findSeedProfile(slug)
  if (!profile) {
    console.error(`unknown seed niche "${slug}"`)
    process.exitCode = 1
    return
  }

  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = process.env
  const redis = url && token ? new Redis({ url, token }) : null
  const deps = createFeedDeps({
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    youtubeApiKey: process.env.YOUTUBE_API_KEY,
    // Same settings as the app: these write to the same cache keys.
    artistIdFor: artistSpotifyId,
    youtubeRelevance: nicheRelevance,
    cleanContext: nicheCleanContext,
    redis,
    logger: log,
  })
  console.log(
    `niche: ${profile.emoji} ${profile.name} · cache: ${noCache ? "off" : redis ? "upstash" : "memory"}`,
  )
  console.log(`disabled (missing keys): ${deps.disabled.join(", ") || "none"}\n`)

  // 1. Each fetcher live, uncached.
  for (const fetcher of deps.fetchers) {
    const startedAt = Date.now()
    try {
      const items = await fetcher.fetch(profile)
      console.log(
        `✓ ${fetcher.source.padEnd(8)} ${items.length} items in ${Date.now() - startedAt}ms`,
      )
      for (const item of items.slice(0, 4)) {
        console.log(`    [${item.type}] ${item.title}${item.subtitle ? ` — ${item.subtitle}` : ""}`)
      }
    } catch (error) {
      console.log(`✗ ${fetcher.source.padEnd(8)} ${errorMessage(error)}`)
    }
  }

  // 2. Full pipeline twice: second run should be served from cache.
  const pipelineDeps = noCache ? { ...deps, cache: memoryStore() } : deps
  for (const run of [1, 2]) {
    const startedAt = Date.now()
    const feed = await buildNicheFeed(profile, pipelineDeps)
    const statuses = feed.statuses
      .map((s) => `${s.source}=${s.state}${s.cache ? `/${s.cache}` : ""}(${s.count})`)
      .join(" ")
    console.log(
      `\nfeed run ${run}: ${feed.items.length} items in ${Date.now() - startedAt}ms · ${statuses}`,
    )
    if (run === 1) {
      for (const item of feed.items.slice(0, 8)) {
        console.log(
          `    ${item.score.toFixed(3)} ${item.source.padEnd(7)} ${item.title.slice(0, 70)}`,
        )
      }
    }
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
