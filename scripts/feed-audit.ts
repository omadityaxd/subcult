/**
 * pnpm feeds:audit [slug …]
 *
 * Runs each niche's cached news and video through the relevance pipeline and
 * prints what it keeps and what it drops (with the reason), so source tiers
 * and negative keywords can be tuned against real data. Reads the shared
 * cache only: no Spotify calls.
 */
import { Redis } from "@upstash/redis"
import { judgeItem, dedupe } from "../src/lib/feed/clean"
import { buildNicheFeed } from "../src/lib/feed/feed"
import { nicheCleanContext, nicheRelevance } from "../src/lib/feed/niche-relevance"
import { createFeedDeps } from "../src/lib/feed/server"
import { findSeedProfile } from "../src/lib/niches/catalog"
import { loadLocalEnv } from "./load-env"

async function main(): Promise<void> {
  loadLocalEnv()
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = process.env
  const redis = url && token ? new Redis({ url, token }) : null
  // No cleanContext here: we want the raw items, then judge them ourselves.
  const deps = createFeedDeps({
    youtubeApiKey: process.env.YOUTUBE_API_KEY,
    youtubeRelevance: nicheRelevance,
    redis,
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  })
  const slugs = process.argv.slice(2)
  for (const slug of slugs.length > 0 ? slugs : ["rage", "vamp", "jerk", "deftones-core"]) {
    const profile = findSeedProfile(slug)
    if (!profile) continue
    const ctx = nicheCleanContext(profile)
    const feed = await buildNicheFeed(profile, deps)
    const raw = [...(feed.bySource.news ?? []), ...(feed.bySource.youtube ?? [])]
    const passed = raw.filter((item) => judgeItem(item, ctx) === null)
    const kept = new Set(dedupe(passed, ctx.sources))
    console.log(`\n## ${slug}: kept ${kept.size} of ${raw.length}`)
    for (const item of raw) {
      const reason = judgeItem(item, ctx) ?? (kept.has(item) ? null : "duplicate")
      const where = String(item.meta.domain ?? item.meta.channel ?? "")
      console.log(
        `${reason ? `  drop ${reason.padEnd(10)}` : "  keep           "} ${item.source.padEnd(7)} ${where.slice(0, 22).padEnd(22)} ${item.title.slice(0, 80)}`,
      )
    }
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
