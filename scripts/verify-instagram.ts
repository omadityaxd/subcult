/**
 * pnpm taxonomy:verify-instagram
 *
 * Instagram serves the same login wall for real and made-up profiles, so a
 * handle can't be "checked" by fetching it. Instead every handle needs
 * independent evidence:
 * - artists: Wikidata (P2003 on the item with our exact Spotify ID, P1902)
 *   AND MusicBrainz (an instagram.com URL relation on the artist our exact
 *   Spotify URL resolves to) must name the same handle;
 * - brands: the brand's own official site must link the profile.
 * Anything with weaker evidence is left out. Writes data/taxonomy/instagram.json.
 */
import fs from "node:fs"
import ARTISTS from "../data/taxonomy/artists.json"
import BRANDS from "../data/taxonomy/brands.json"

const USER_AGENT = "subcult/1.0 (https://github.com/omadityaxd/subcult; instagram verification)"
const MUSICBRAINZ_GAP_MS = 1100 // MusicBrainz asks for at most one request per second.
const HANDLE = /instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#"']|$)/g
const NOT_PROFILES = new Set([
  "p",
  "reel",
  "reels",
  "explore",
  "stories",
  "accounts",
  "tv",
  "about",
])

interface Evidence {
  handle: string
  sources: string[]
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const norm = (handle: string) => handle.toLowerCase().replace(/\/$/, "")

async function wikidataHandles(): Promise<Map<string, { handles: string[]; qid: string }>> {
  const ids = ARTISTS.map((artist) => artist.spotifyId).filter(Boolean)
  const query = `SELECT ?spotify ?item ?insta WHERE { VALUES ?spotify { ${ids.map((id) => `"${id}"`).join(" ")} } ?item wdt:P1902 ?spotify . ?item wdt:P2003 ?insta . }`
  const response = await fetch("https://query.wikidata.org/sparql", {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/sparql-results+json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ query, format: "json" }),
  })
  if (!response.ok) throw new Error(`Wikidata ${response.status}`)
  const body = (await response.json()) as {
    results: {
      bindings: { spotify: { value: string }; item: { value: string }; insta: { value: string } }[]
    }
  }
  const out = new Map<string, { handles: string[]; qid: string }>()
  for (const row of body.results.bindings) {
    const entry = out.get(row.spotify.value) ?? {
      handles: [],
      qid: row.item.value.split("/").pop() ?? "",
    }
    entry.handles.push(norm(row.insta.value))
    out.set(row.spotify.value, entry)
  }
  return out
}

async function musicbrainzHandles(
  spotifyId: string,
): Promise<{ handles: string[]; mbid: string } | null> {
  const resource = encodeURIComponent(`https://open.spotify.com/artist/${spotifyId}`)
  const urlResponse = await fetch(
    `https://musicbrainz.org/ws/2/url?resource=${resource}&inc=artist-rels&fmt=json`,
    { headers: { "User-Agent": USER_AGENT } },
  )
  await sleep(MUSICBRAINZ_GAP_MS)
  if (!urlResponse.ok) return null
  const url = (await urlResponse.json()) as { relations?: { artist?: { id: string } }[] }
  const mbid = url.relations?.find((relation) => relation.artist)?.artist?.id
  if (!mbid) return null
  const artistResponse = await fetch(
    `https://musicbrainz.org/ws/2/artist/${mbid}?inc=url-rels&fmt=json`,
    {
      headers: { "User-Agent": USER_AGENT },
    },
  )
  await sleep(MUSICBRAINZ_GAP_MS)
  if (!artistResponse.ok) return null
  const artist = (await artistResponse.json()) as { relations?: { url?: { resource: string } }[] }
  const handles = (artist.relations ?? []).flatMap((relation) =>
    [...(relation.url?.resource ?? "").matchAll(HANDLE)].map((match) => norm(match[1])),
  )
  return { handles: handles.filter((handle) => !NOT_PROFILES.has(handle)), mbid }
}

async function brandHandle(officialUrl: string): Promise<string | null> {
  try {
    const response = await fetch(officialUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; subcult/1.0)" },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) return null
    const html = await response.text()
    const handles = [...html.matchAll(HANDLE)]
      .map((match) => norm(match[1]))
      .filter((handle) => !NOT_PROFILES.has(handle))
    const counts = new Map<string, number>()
    for (const handle of handles) counts.set(handle, (counts.get(handle) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  } catch {
    return null
  }
}

async function main(): Promise<void> {
  const wikidata = await wikidataHandles()
  const artists: Record<string, Evidence> = {}
  let checked = 0
  for (const artist of ARTISTS) {
    const wd = wikidata.get(artist.spotifyId)
    if (!wd) continue
    checked += 1
    const mb = await musicbrainzHandles(artist.spotifyId)
    const agreed = wd.handles.find((handle) => mb?.handles.includes(handle))
    if (agreed && mb) {
      artists[artist.slug] = {
        handle: agreed,
        sources: [
          `https://www.wikidata.org/wiki/${wd.qid}`,
          `https://musicbrainz.org/artist/${mb.mbid}`,
        ],
      }
    }
    if (checked % 20 === 0)
      console.log(`  ${checked} checked, ${Object.keys(artists).length} agreed`)
  }

  const brands: Record<string, Evidence> = {}
  for (const brand of BRANDS) {
    if (!brand.officialUrl) continue
    const handle = await brandHandle(brand.officialUrl)
    if (handle) brands[brand.slug] = { handle, sources: [brand.officialUrl] }
  }

  fs.writeFileSync(
    "data/taxonomy/instagram.json",
    `${JSON.stringify({ verifiedAt: new Date().toISOString().slice(0, 10), artists, brands }, null, 2)}\n`,
  )
  console.log(
    `artists: ${Object.keys(artists).length} verified of ${checked} with a Wikidata handle; brands: ${Object.keys(brands).length}`,
  )
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
