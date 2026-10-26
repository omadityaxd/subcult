import { z } from "zod"
import { lookupKey } from "@/lib/taxonomy/graph"
import { creditsArtist } from "./itunes"

/**
 * New releases from the iTunes Search/Lookup API (free, keyless). Search is
 * fuzzy (a "nettspend" search returns other people's tributes), so an
 * artist is first resolved to its iTunes artist id by exact name, then its
 * albums and singles come from the id lookup, newest first.
 */
const SEARCH_URL = "https://itunes.apple.com/search"
const LOOKUP_URL = "https://itunes.apple.com/lookup"
const DAY_MS = 24 * 3600_000

const artistSchema = z.object({
  wrapperType: z.literal("artist"),
  artistId: z.number(),
  artistName: z.string(),
})
const collectionSchema = z.object({
  wrapperType: z.literal("collection"),
  collectionId: z.number(),
  collectionName: z.string(),
  artistName: z.string(),
  releaseDate: z.string(),
  trackCount: z.number().optional(),
  artworkUrl100: z.string().url().optional(),
  collectionViewUrl: z.string().url().optional(),
})
const responseSchema = z.object({ results: z.array(z.unknown()) })

export interface Release {
  id: string
  artist: string
  title: string
  kind: "single" | "ep" | "album"
  releasedAt: string
  artworkUrl: string | null
  appleUrl: string | null
}

const parse = <T>(schema: z.ZodType<T>, json: unknown): T[] => {
  const body = responseSchema.safeParse(json)
  if (!body.success) return []
  return body.data.results.flatMap((row) => {
    const parsed = schema.safeParse(row)
    return parsed.success ? [parsed.data] : []
  })
}

/** The iTunes artist whose name is exactly this artist's (case/punctuation-insensitive). */
export function pickArtistId(json: unknown, name: string): number | null {
  const key = lookupKey(name)
  return parse(artistSchema, json).find((a) => lookupKey(a.artistName) === key)?.artistId ?? null
}

const kindOf = (title: string, tracks: number | undefined): Release["kind"] => {
  if (/\s-\s?single$/i.test(title) || tracks === 1) return "single"
  if (/\s-\s?ep$/i.test(title) || (tracks !== undefined && tracks <= 6)) return "ep"
  return "album"
}

/**
 * Releases from an artist lookup that credit the artist, within the last
 * `days`, newest first. The credit check matters: a composer's iTunes page
 * lists every compilation that performs their work ("Classical Lullabies").
 */
export function pickRecentReleases(
  json: unknown,
  now: number,
  days: number,
  artist: string,
): Release[] {
  return parse(collectionSchema, json)
    .filter((c) => creditsArtist(c.artistName, artist))
    .filter((c) => {
      const age = now - Date.parse(c.releaseDate)
      return age >= 0 && age <= days * DAY_MS
    })
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))
    .map((c) => ({
      id: `itunes:${c.collectionId}`,
      artist: c.artistName,
      title: c.collectionName.replace(/\s-\s?(single|ep)$/i, ""),
      kind: kindOf(c.collectionName, c.trackCount),
      releasedAt: new Date(c.releaseDate).toISOString(),
      artworkUrl: c.artworkUrl100?.replace("100x100bb", "600x600bb") ?? null,
      appleUrl: c.collectionViewUrl ?? null,
    }))
}

interface FetchOptions {
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export async function findItunesArtistId(
  name: string,
  { fetchImpl = fetch, timeoutMs = 6000 }: FetchOptions = {},
): Promise<number | null> {
  const query = new URLSearchParams({
    term: name,
    entity: "musicArtist",
    attribute: "artistTerm",
    limit: "10",
    country: "US",
  })
  const response = await fetchImpl(`${SEARCH_URL}?${query}`, {
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`iTunes artist search ${response.status}`)
  return pickArtistId(await response.json(), name)
}

export async function findRecentReleases(
  artistId: number,
  artist: string,
  {
    now = Date.now(),
    days = 14,
    fetchImpl = fetch,
    timeoutMs = 6000,
  }: FetchOptions & {
    now?: number
    days?: number
  } = {},
): Promise<Release[]> {
  const query = new URLSearchParams({
    id: String(artistId),
    entity: "album",
    sort: "recent",
    limit: "15",
    country: "US",
  })
  const response = await fetchImpl(`${LOOKUP_URL}?${query}`, {
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`iTunes lookup ${response.status}`)
  return pickRecentReleases(await response.json(), now, days, artist)
}

const songSchema = z.object({
  wrapperType: z.literal("track"),
  previewUrl: z.string().url(),
  trackTimeMillis: z.number().optional(),
})

/** A release's playable 30s preview: its first song that has one. */
export function pickCollectionPreview(
  json: unknown,
): { previewUrl: string; durationMs: number | null } | null {
  const song = parse(songSchema, json)[0]
  return song ? { previewUrl: song.previewUrl, durationMs: song.trackTimeMillis ?? null } : null
}

/**
 * Looks a release up by its Apple collection id. Search can miss a brand-new
 * single entirely; the release's own track list always has its preview.
 */
export async function findCollectionPreview(
  collectionId: string,
  { fetchImpl = fetch, timeoutMs = 6000 }: FetchOptions = {},
): Promise<{ previewUrl: string; durationMs: number | null } | null> {
  const query = new URLSearchParams({ id: collectionId, entity: "song", country: "US" })
  const response = await fetchImpl(`${LOOKUP_URL}?${query}`, {
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`iTunes lookup ${response.status}`)
  return pickCollectionPreview(await response.json())
}
