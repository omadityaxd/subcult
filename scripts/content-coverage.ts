/**
 * pnpm content:coverage [slug …]
 *
 * Per niche: how much real, relevant content each pipeline supplies right
 * now (fits, grails, tea with images, tracks, pins, videos), flagging any
 * niche under threshold. Reads through the shared cache, so it reflects
 * what production has fetched; misses are fetched with the local keys.
 */
import { loadLocalEnv } from "./load-env"

async function main(): Promise<void> {
  loadLocalEnv()
  const { mapWithConcurrency } = await import("../src/lib/concurrency")
  const { appFeedDeps } = await import("../src/lib/feed/app-deps")
  const { buildNicheFeed } = await import("../src/lib/feed/feed")
  const { moodboardFeedItems } = await import("../src/lib/moodboard/board")
  const { getMoodboard } = await import("../src/lib/moodboard/server")
  const { getSoundtrack } = await import("../src/lib/music/soundtrack-server")
  const { SEED_PROFILES, TAXONOMY } = await import("../src/lib/niches/catalog")
  const { archiveFeedItems, getArchive } = await import("../src/lib/shop/server")
  const { nicheFits } = await import("../src/lib/fits/server")
  const { formatCoverage } = await import("../src/lib/coverage/coverage")
  const { env } = await import("../src/lib/env")

  const only = process.argv.slice(2)
  const featured = new Set(TAXONOMY.featured())
  const profiles = only.length ? SEED_PROFILES.filter((p) => only.includes(p.slug)) : SEED_PROFILES
  const results = await mapWithConcurrency(profiles, 3, async (profile) => {
    const [feed, board, archive, soundtrack, fits] = await Promise.all([
      buildNicheFeed(profile, appFeedDeps()).catch(() => null),
      getMoodboard(profile.slug),
      getArchive(profile.slug).catch(() => null),
      getSoundtrack(profile.slug),
      nicheFits(profile.slug, 50),
    ])
    const pins = moodboardFeedItems(board.pins)
    const fitPins = pins.filter((item) => item.meta.fit === true)
    const fitVideos = (feed?.bySource.youtube ?? []).filter((item) => item.meta.fitCheck === true)
    return {
      slug: profile.slug,
      featured: featured.has(profile.slug),
      fashion: TAXONOMY.branchOf(profile.slug) === "underground-fashion",
      counts: {
        fits: fits.length + fitPins.length + fitVideos.length,
        grails: archiveFeedItems(archive ?? []).length,
        tea: (feed?.bySource.news ?? []).filter((item) => item.imageUrl).length,
        tracks: soundtrack?.tracks.length ?? 0,
        // Real moodboard images only: artist press photos aren't pins.
        pins: pins.filter((item) => item.source !== "subcult" && item.meta.fit !== true).length,
        videos: (feed?.bySource.youtube ?? []).length,
      },
    }
  })
  const rows = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))
  rows.sort((a, b) => Number(b.featured) - Number(a.featured) || a.slug.localeCompare(b.slug))
  const keys = {
    ebay: Boolean(env.EBAY_CLIENT_ID && env.EBAY_CLIENT_SECRET),
    anthropic: Boolean(env.ANTHROPIC_API_KEY),
    unsplash: Boolean(env.UNSPLASH_ACCESS_KEY),
    pexels: Boolean(env.PEXELS_API_KEY),
    youtube: Boolean(env.YOUTUBE_API_KEY),
    spotify: Boolean(env.SPOTIFY_CLIENT_ID),
  }
  console.log(`keys in this environment: ${JSON.stringify(keys)}\n`)
  console.log(formatCoverage(rows))
  process.exit(0)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
