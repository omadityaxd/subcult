import { z } from "zod"
import { lookupKey } from "@/lib/taxonomy/graph"

/**
 * iTunes Search API: free, keyless, ~20 calls/minute. Apple's terms allow
 * previews only to promote store content, shown near a store badge, so every
 * preview we play carries an Apple Music link (see the story music sticker).
 * Spotify stopped returning preview_url for new apps in Nov 2024.
 */
const SEARCH_URL = "https://itunes.apple.com/search"

const resultSchema = z.object({
  trackId: z.number(),
  artistName: z.string(),
  trackName: z.string(),
  previewUrl: z.string().url().optional(),
  trackViewUrl: z.string().url().optional(),
  artworkUrl100: z.string().url().optional(),
  trackTimeMillis: z.number().optional(),
})
const responseSchema = z.object({ results: z.array(z.unknown()) })

export type ItunesResult = z.infer<typeof resultSchema>

export interface Preview {
  previewUrl: string
  /** Apple Music page for the track: the store link Apple's terms ask for. */
  appleUrl: string | null
  title: string
  artist: string
  artworkUrl: string | null
  /** Full song length (the preview itself is ~30s). */
  durationMs: number | null
}

/** Strip "(feat. …)", "(prod. …)", "[Remix]", " - Remastered", "ft." and punctuation. */
export function normalizeTitle(title: string): string {
  return lookupKey(
    title
      .replace(/\s*[([{].*?[)\]}]/g, "")
      .replace(/\s+-\s+.*$/, "")
      .replace(/\b(?:feat|ft|prod)\.?\s.*$/i, ""),
  )
}

/** Edit distance, for one-character slips ("Lil Uzi Vert" vs "Lil Uzi Vertt"). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (row[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    previous = row
  }
  return previous[b.length] ?? 0
}

/** Same name, allowing "The …", spacing and one slip on longer names. */
function nearlySame(a: string, b: string): boolean {
  const clean = (text: string) => text.replace(/^the-/, "").replace(/-/g, "")
  const x = clean(a)
  const y = clean(b)
  if (x === y) return true
  return Math.min(x.length, y.length) >= 6 && editDistance(x, y) <= 1
}

/** Separators between artists in a credit: "A, B & C feat. D with E x F". */
const CREDIT_SEPARATOR = /\s*(?:,|&|\bx\b|\bfeat\.?|\bwith\b)\s*/i

/** Credits like "Nettspend & xaviersobased" or "Che, OsamaSon" contain the artist. */
export function creditsArtist(credit: string, artist: string, fuzzy = false): boolean {
  const target = lookupKey(artist)
  return credit
    .split(CREDIT_SEPARATOR)
    .some((part) => lookupKey(part) === target || (fuzzy && nearlySame(lookupKey(part), target)))
}

/** "strict": the exact credit and title (the original matcher); "fuzzy": allow slips, retry looser. */
export type MatchMode = "strict" | "fuzzy"

const primaryCredit = (credit: string): string => credit.split(CREDIT_SEPARATOR)[0] ?? credit

function parseResults(body: unknown): ItunesResult[] {
  const parsed = responseSchema.safeParse(body)
  if (!parsed.success) return []
  return parsed.data.results.flatMap((raw) => {
    const result = resultSchema.safeParse(raw)
    return result.success && result.data.previewUrl ? [result.data] : []
  })
}

const toPreview = (result: ItunesResult): Preview => ({
  previewUrl: result.previewUrl as string,
  appleUrl: result.trackViewUrl ?? null,
  title: result.trackName,
  artist: result.artistName,
  // 100px art upscaled by Apple's CDN naming scheme.
  artworkUrl: result.artworkUrl100?.replace("100x100bb", "600x600bb") ?? null,
  durationMs: result.trackTimeMillis ?? null,
})

/** Best result that credits the artist and has the same (normalized) title. */
export function pickExactMatch(
  results: readonly ItunesResult[],
  artist: string,
  title: string,
  mode: MatchMode = "fuzzy",
): Preview | null {
  const wanted = normalizeTitle(title)
  const fuzzy = mode === "fuzzy"
  const credited = (result: ItunesResult) => creditsArtist(result.artistName, artist, fuzzy)
  const match =
    // An exact title first, so a near-miss never beats the real song.
    results.find((result) => credited(result) && normalizeTitle(result.trackName) === wanted) ??
    (fuzzy
      ? results.find(
          (result) => credited(result) && nearlySame(normalizeTitle(result.trackName), wanted),
        )
      : undefined)
  return match ? toPreview(match) : null
}

/**
 * Most relevant song where the artist is the lead credit; only then a song
 * they merely feature on (so A$AP Rocky gets a Rocky song, not a game tie-in).
 */
export function pickArtistSong(results: readonly ItunesResult[], artist: string): Preview | null {
  const target = lookupKey(artist)
  const match =
    results.find((result) => lookupKey(result.artistName) === target) ??
    results.find((result) => lookupKey(primaryCredit(result.artistName)) === target) ??
    results.find((result) => creditsArtist(result.artistName, artist))
  return match ? toPreview(match) : null
}

interface SearchOptions {
  fetchImpl?: typeof fetch
  country?: string
}

export async function searchSongs(
  params: Record<string, string>,
  { fetchImpl = fetch, country = "US" }: SearchOptions,
): Promise<ItunesResult[]> {
  const query = new URLSearchParams({ media: "music", entity: "song", country, ...params })
  const response = await fetchImpl(`${SEARCH_URL}?${query}`)
  if (!response.ok) throw new Error(`iTunes search ${response.status}`)
  return parseResults(await response.json())
}

/**
 * Preview for an artist + title, or null when iTunes doesn't have that song.
 * Fuzzy mode retries once with a looser query (the title alone) when the
 * artist + title search finds nothing: iTunes often files a song under a
 * featured credit or a slightly different spelling.
 */
export async function findTrackPreview(
  artist: string,
  title: string,
  options: SearchOptions & { mode?: MatchMode } = {},
): Promise<Preview | null> {
  const mode = options.mode ?? "fuzzy"
  const cleanTitle = normalizeTitle(title).replace(/-/g, " ")
  const results = await searchSongs({ term: `${artist} ${cleanTitle}`, limit: "10" }, options)
  const first = pickExactMatch(results, artist, title, mode)
  if (first || mode === "strict" || cleanTitle.length < 3) return first
  const looser = await searchSongs({ term: cleanTitle, limit: "25" }, options)
  return pickExactMatch(looser, artist, title, mode)
}

/** A representative song for an artist (used when no Spotify track list is available). */
export async function findArtistPreview(
  artist: string,
  options: SearchOptions = {},
): Promise<Preview | null> {
  const results = await searchSongs({ term: artist, attribute: "artistTerm", limit: "15" }, options)
  return pickArtistSong(results, artist)
}

/**
 * Several songs for an artist, lead credits first (features after), one per
 * normalized title so remixes and explicit/clean twins don't repeat.
 */
export function pickArtistSongs(
  results: readonly ItunesResult[],
  artist: string,
  limit: number,
): Preview[] {
  const target = lookupKey(artist)
  const lead = results.filter((result) => lookupKey(primaryCredit(result.artistName)) === target)
  const featured = results.filter(
    (result) => !lead.includes(result) && creditsArtist(result.artistName, artist),
  )
  const seen = new Set<string>()
  return [...lead, ...featured]
    .filter((result) => {
      const key = normalizeTitle(result.trackName)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, limit)
    .map(toPreview)
}

/** Up to `limit` songs credited to the artist (soundtrack queues). */
export async function findArtistSongs(
  artist: string,
  limit: number,
  options: SearchOptions = {},
): Promise<Preview[]> {
  const results = await searchSongs({ term: artist, attribute: "artistTerm", limit: "25" }, options)
  return pickArtistSongs(results, artist, limit)
}
