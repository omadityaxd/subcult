/**
 * pnpm previews:rate
 *
 * The share of Spotify tracks on the featured niches that find an iTunes
 * 30s preview, with the original strict matcher vs the fuzzy one (title
 * normalization, fuzzy artist names, one looser retry). Both are scored on
 * the same first search, so the difference is the matcher, not luck.
 * Paced for iTunes' ~20 calls a minute. Writes docs/perf/preview-match-rate.txt.
 */
import { writeFileSync } from "node:fs"
import { loadLocalEnv } from "./load-env"

const NICHES = 15
const TRACKS_PER_NICHE = 4
const PAUSE_MS = 3200

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function main(): Promise<void> {
  loadLocalEnv()
  const { TAXONOMY, findSeedProfile } = await import("../src/lib/niches/catalog")
  const { buildNicheFeed } = await import("../src/lib/feed/feed")
  const { appFeedDeps } = await import("../src/lib/feed/app-deps")
  const { searchSongs, pickExactMatch, normalizeTitle } = await import("../src/lib/music/itunes")

  const lines: string[] = []
  let strictHits = 0
  let fuzzyHits = 0
  let total = 0
  let failed = 0
  const tracked = <T>(work: Promise<T[]>) =>
    work.catch((): T[] => {
      failed += 1
      return []
    })
  for (const slug of TAXONOMY.featured().slice(0, NICHES)) {
    const profile = findSeedProfile(slug)
    if (!profile) continue
    const feed = await buildNicheFeed(profile, appFeedDeps()).catch(() => null)
    const tracks = (feed?.bySource.spotify ?? [])
      .filter((item) => item.type === "track" && item.subtitle)
      .slice(0, TRACKS_PER_NICHE)
    let nicheStrict = 0
    let nicheFuzzy = 0
    for (const track of tracks) {
      const artist = (track.subtitle ?? "").split(",")[0]?.trim() ?? ""
      const cleanTitle = normalizeTitle(track.title).replace(/-/g, " ")
      const first = await tracked(searchSongs({ term: `${artist} ${cleanTitle}`, limit: "10" }, {}))
      await sleep(PAUSE_MS)
      const strict = pickExactMatch(first, artist, track.title, "strict")
      let fuzzy = pickExactMatch(first, artist, track.title, "fuzzy")
      if (!fuzzy && cleanTitle.length >= 3) {
        const looser = await tracked(searchSongs({ term: cleanTitle, limit: "25" }, {}))
        await sleep(PAUSE_MS)
        fuzzy = pickExactMatch(looser, artist, track.title, "fuzzy")
      }
      total += 1
      if (strict) nicheStrict += 1
      if (fuzzy) nicheFuzzy += 1
      lines.push(`  ${strict ? "S" : "-"}${fuzzy ? "F" : "-"}  ${slug}: ${track.title} | ${artist}`)
    }
    strictHits += nicheStrict
    fuzzyHits += nicheFuzzy
    console.log(
      `${slug}: strict ${nicheStrict}/${tracks.length}, fuzzy ${nicheFuzzy}/${tracks.length}`,
    )
  }
  const pct = (n: number) => (total ? `${Math.round((n / total) * 100)}%` : "-")
  const summary = [
    `Preview match rate, ${new Date().toISOString().slice(0, 10)}`,
    `${total} Spotify tracks from ${NICHES} featured niches (${TRACKS_PER_NICHE} each)`,
    `before (strict): ${strictHits}/${total} = ${pct(strictHits)}`,
    `after (fuzzy + retry): ${fuzzyHits}/${total} = ${pct(fuzzyHits)}`,
    `iTunes requests that failed (rate limit / network): ${failed}`,
    "Misses checked by hand (e.g. Playboi Carti - Magnolia, A$AP Rocky - Fashion Killa) aren't in",
    "the iTunes Search catalog in US, GB, IN or CA: those play through the Spotify embed.",
    "",
    "S = strict match, F = fuzzy match",
    ...lines,
  ].join("\n")
  writeFileSync("docs/perf/preview-match-rate.txt", `${summary}\n`)
  console.log(`\n${summary.split("\n").slice(0, 4).join("\n")}`)
  process.stdout.write("", () => process.exit(0))
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
