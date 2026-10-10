/**
 * pnpm taxonomy:verify-artists
 *
 * Confirms every artist named in a niche profile against Spotify search and
 * writes data/taxonomy/artists.json (name, exact Spotify ID, image). Only
 * exact (case/punctuation-insensitive) name matches count. When several
 * Spotify artists share a name, the one credited on that name's top tracks
 * wins; anything still ambiguous is reported and must be pinned in
 * data/taxonomy/artist-overrides.json. Nothing unverified is ever written.
 *
 * Re-running is idempotent: same Spotify data, byte-identical file.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"
import { SEED_PROFILES } from "../src/lib/niches/catalog"
import {
  type SpotifyClient,
  SpotifyRateLimitError,
  createSpotifyClient,
} from "../src/lib/sources/spotify"
import { lookupKey } from "../src/lib/taxonomy/graph"
import type { Artist } from "../src/lib/taxonomy/schema"
import { loadLocalEnv } from "./load-env"

const DATA_DIR = join(process.cwd(), "data", "taxonomy")
const CONCURRENCY = 1
const MAX_RETRIES = 3
/** Longer than this and we stop: dev-mode bans can last ~a day, and retrying extends them. */
const MAX_WAIT_SECONDS = 90

const overridesSchema = z.object({
  /** Profile name → Spotify artist ID, for names Spotify search can't settle. */
  pins: z.record(z.string(), z.string().regex(/^[0-9A-Za-z]{22}$/)).default({}),
  /** Extra search aliases per artist name. */
  aliases: z.record(z.string(), z.array(z.string())).default({}),
  /** Names whose Spotify match couldn't be tied to the right person: never linked. */
  exclude: z.array(z.string()).default([]),
})

interface Candidate {
  id: string
  name: string
  imageUrl: string | null
}

type Outcome =
  | { status: "verified"; artist: Candidate; via: "unique" | "tracks" | "pin" }
  | { status: "ambiguous"; candidates: Candidate[] }
  | { status: "unmatched"; nearest: string[] }

async function withRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run()
    } catch (error) {
      if (!(error instanceof SpotifyRateLimitError)) throw error
      if (error.retryAfterSeconds > MAX_WAIT_SECONDS || attempt >= MAX_RETRIES) {
        const hours = (error.retryAfterSeconds / 3600).toFixed(1)
        throw new Error(
          `Spotify rate limit: retry after ${error.retryAfterSeconds}s (~${hours}h). Stopping without changes.`,
        )
      }
      await new Promise((resolve) => setTimeout(resolve, error.retryAfterSeconds * 1000))
    }
  }
}

async function verify(
  spotify: SpotifyClient,
  name: string,
  pinnedId: string | undefined,
): Promise<Outcome> {
  const response = await withRetry(() => spotify.search(name, "artist", 10))
  const results = (response.artists?.items ?? []).flatMap((item) =>
    item ? [{ id: item.id, name: item.name, imageUrl: item.images?.[0]?.url ?? null }] : [],
  )

  if (pinnedId) {
    const pinned = results.find((candidate) => candidate.id === pinnedId)
    // A pin outside the first page still needs a name to write; trust the pin's ID.
    return {
      status: "verified",
      artist: pinned ?? { id: pinnedId, name, imageUrl: null },
      via: "pin",
    }
  }

  const exact = results.filter((candidate) => lookupKey(candidate.name) === lookupKey(name))
  if (exact.length === 1) return { status: "verified", artist: exact[0], via: "unique" }
  if (exact.length === 0) {
    return { status: "unmatched", nearest: results.slice(0, 3).map((r) => r.name) }
  }

  // Several artists share the name: count who is actually credited on the name's tracks.
  // Plain-name search: the artist:"…" field filter is currently fuzzy and returns unrelated tracks.
  const tracks = await withRetry(() => spotify.search(name, "track", 10))
  const credits = new Map<string, number>()
  for (const track of tracks.tracks?.items ?? []) {
    for (const credited of track?.artists ?? []) {
      if (credited.id) credits.set(credited.id, (credits.get(credited.id) ?? 0) + 1)
    }
  }
  const ranked = exact
    .map((candidate) => ({ candidate, count: credits.get(candidate.id) ?? 0 }))
    .sort((a, b) => b.count - a.count)
  const [best, runnerUp] = ranked
  if (best.count > 0 && best.count >= 2 * (runnerUp?.count ?? 0) && best.candidate.imageUrl) {
    return { status: "verified", artist: best.candidate, via: "tracks" }
  }
  return { status: "ambiguous", candidates: exact }
}

async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const index = next++
        results[index] = await run(items[index])
      }
    }),
  )
  return results
}

async function main(): Promise<void> {
  loadLocalEnv()
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    console.error("Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in .env.local.")
    process.exitCode = 1
    return
  }
  const overrides = overridesSchema.parse(
    JSON.parse(readFileSync(join(DATA_DIR, "artist-overrides.json"), "utf8")),
  )
  const spotify = createSpotifyClient({ clientId, clientSecret })

  // One lookup per distinct artist name across every niche profile.
  const names = [
    ...new Map(
      SEED_PROFILES.flatMap((profile) => profile.artists.map((artist) => artist.name)).map(
        (name) => [lookupKey(name), name],
      ),
    ).values(),
  ]
    .filter(
      (name) => !overrides.exclude.some((excluded) => lookupKey(excluded) === lookupKey(name)),
    )
    .sort((a, b) => a.localeCompare(b))

  const outcomes = await mapLimit(names, CONCURRENCY, (name) =>
    verify(spotify, name, overrides.pins[name]),
  )

  const byId = new Map<string, Artist>()
  const ambiguous: string[] = []
  const unmatched: string[] = []
  const via = { unique: 0, tracks: 0, pin: 0 }
  names.forEach((name, index) => {
    const outcome = outcomes[index]
    if (outcome.status === "ambiguous") {
      ambiguous.push(
        `${name}: ${outcome.candidates.map((c) => `${c.id}${c.imageUrl ? "" : " (no image)"}`).join(", ")}`,
      )
      return
    }
    if (outcome.status === "unmatched") {
      unmatched.push(`${name} (nearest: ${outcome.nearest.join(", ") || "none"})`)
      return
    }
    via[outcome.via]++
    const { artist } = outcome
    const existing = byId.get(artist.id)
    const extraAliases = [
      ...(overrides.aliases[name] ?? []),
      ...(lookupKey(name) === lookupKey(artist.name) ? [] : [name]),
    ]
    byId.set(artist.id, {
      slug: existing?.slug ?? lookupKey(artist.name),
      name: artist.name,
      aliases: [...new Set([...(existing?.aliases ?? []), ...extraAliases])].sort(),
      spotifyId: artist.id,
      imageUrl: artist.imageUrl,
    })
  })

  const artists = [...byId.values()].sort((a, b) => a.slug.localeCompare(b.slug))
  writeFileSync(join(DATA_DIR, "artists.json"), `${JSON.stringify(artists, null, 2)}\n`)

  console.log(
    `${names.length} names: ${artists.length} verified (${via.unique} unique, ${via.tracks} by track credits, ${via.pin} pinned)`,
  )
  if (ambiguous.length)
    console.log(`\nAmbiguous (pin one ID in artist-overrides.json):\n  ${ambiguous.join("\n  ")}`)
  if (unmatched.length)
    console.log(`\nNot found on Spotify (left unlinked):\n  ${unmatched.join("\n  ")}`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
