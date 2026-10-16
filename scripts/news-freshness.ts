/**
 * pnpm news:freshness [slug …]
 *
 * Median age of the headlines a niche actually shows (after the relevance
 * pipeline), for the old fetch (profile phrases, 14 days) vs the current one
 * (entity queries + scene feeds, 7 days). Live network calls, no cache.
 */
import { cleanFeed } from "../src/lib/feed/clean"
import { newsFetcher } from "../src/lib/feed/fetchers/news"
import { nicheCleanContext } from "../src/lib/feed/niche-relevance"
import type { FeedItem } from "../src/lib/feed/types"
import { SEED_PROFILES, findSeedProfile } from "../src/lib/niches/catalog"
import { fetchGoogleNews } from "../src/lib/sources/google-news"

const HOUR = 3600_000

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

async function legacy(profile: (typeof SEED_PROFILES)[number]): Promise<FeedItem[]> {
  const lists = await Promise.allSettled(
    profile.newsQueries.slice(0, 2).map((query) => fetchGoogleNews(query, { days: 14 })),
  )
  return lists
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .slice(0, 12)
    .map((a, i) => ({
      id: `old:${i}`,
      source: "news" as const,
      type: "article" as const,
      title: a.title,
      subtitle: a.outlet,
      imageUrl: null,
      url: a.url,
      publishedAt: a.publishedAt?.toISOString() ?? null,
      score: 0,
      meta: { outlet: a.outlet, domain: a.domain },
    }))
}

const ages = (items: FeedItem[], now: number) =>
  items.flatMap((item) =>
    item.publishedAt ? [(now - new Date(item.publishedAt).getTime()) / HOUR] : [],
  )

async function main(): Promise<void> {
  const slugs = process.argv.slice(2)
  const profiles = slugs.length
    ? slugs.flatMap((slug) => findSeedProfile(slug) ?? [])
    : SEED_PROFILES.slice(0, 20)
  const now = Date.now()
  const all = { before: [] as number[], after: [] as number[] }
  let shownBefore = 0
  let shownAfter = 0
  for (const profile of profiles) {
    const ctx = nicheCleanContext(profile)
    const before = cleanFeed(await legacy(profile), ctx)
    const after = cleanFeed(await newsFetcher().fetch(profile), ctx)
    all.before.push(...ages(before, now))
    all.after.push(...ages(after, now))
    shownBefore += before.length
    shownAfter += after.length
    const fmt = (v: number | null) => (v === null ? "  -  " : `${v.toFixed(0).padStart(4)}h`)
    console.log(
      `${profile.slug.padEnd(28)} before ${String(before.length).padStart(2)} items, median ${fmt(median(ages(before, now)))} | after ${String(after.length).padStart(2)} items, median ${fmt(median(ages(after, now)))} (${after.filter((i) => i.imageUrl).length} with image)`,
    )
  }
  const m = (v: number[]) => median(v)?.toFixed(0) ?? "-"
  console.log(
    `\nALL ${profiles.length} niches: before ${shownBefore} items, median ${m(all.before)}h | after ${shownAfter} items, median ${m(all.after)}h`,
  )
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
