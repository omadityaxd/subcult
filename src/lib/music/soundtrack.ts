import type { FeedItem } from "@/lib/feed/types"
import type { Artist } from "@/lib/taxonomy/schema"
import { type Preview, normalizeTitle } from "./itunes"

/** One playable row of a niche soundtrack. */
export interface SoundtrackTrack {
  id: string
  title: string
  artist: string
  previewUrl: string
  artworkUrl: string | null
  /** Full song length; the preview itself is ~30s. */
  durationMs: number | null
  /** Exact Spotify track when we could match it, else a Spotify search for it. */
  spotifyUrl: string
  appleUrl: string | null
}

export interface Soundtrack {
  slug: string
  title: string
  tracks: SoundtrackTrack[]
}

export const SOUNDTRACK_ARTISTS = 8
export const SONGS_PER_ARTIST = 3
export const SOUNDTRACK_MAX = 20

export const spotifySearchUrl = (title: string, artist: string): string =>
  `https://open.spotify.com/search/${encodeURIComponent(`${title} ${artist}`)}`

interface BuildInput {
  /** Verified artists, lead first. */
  artists: readonly Pick<Artist, "name" | "spotifyId">[]
  songsFor: (artist: Pick<Artist, "name" | "spotifyId">) => Promise<Preview[]>
  /** Exact Spotify URL for a song, when Spotify is reachable. */
  spotifyUrlFor?: (song: Preview, artist: Pick<Artist, "spotifyId">) => Promise<string | null>
  max?: number
}

/**
 * A niche's soundtrack: songs from its verified artists, interleaved
 * round-robin (lead artist first) so no artist dominates, deduped by title.
 * Only tracks with real previews make it in; nothing is invented.
 */
export async function buildSoundtrack({
  artists,
  songsFor,
  spotifyUrlFor,
  max = SOUNDTRACK_MAX,
}: BuildInput): Promise<SoundtrackTrack[]> {
  const picked = artists.slice(0, SOUNDTRACK_ARTISTS)
  const lists = await Promise.all(
    picked.map((artist) => songsFor(artist).catch((): Preview[] => [])),
  )
  const seen = new Set<string>()
  const ordered: { song: Preview; artist: (typeof picked)[number] }[] = []
  for (let round = 0; round < SONGS_PER_ARTIST; round++) {
    lists.forEach((songs, index) => {
      const song = songs[round]
      if (!song) return
      const key = normalizeTitle(song.title)
      if (seen.has(key)) return
      seen.add(key)
      ordered.push({ song, artist: picked[index] })
    })
  }
  const chosen = ordered.slice(0, max)
  return Promise.all(
    chosen.map(async ({ song, artist }) => {
      const exact = await spotifyUrlFor?.(song, artist).catch(() => null)
      return {
        id: `preview:${song.previewUrl}`,
        title: song.title,
        artist: song.artist,
        previewUrl: song.previewUrl,
        artworkUrl: song.artworkUrl,
        durationMs: song.durationMs,
        spotifyUrl: exact ?? spotifySearchUrl(song.title, song.artist),
        appleUrl: song.appleUrl,
      }
    }),
  )
}

/** "3:07" */
export function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return ""
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

/**
 * A soundtrack song as a feed item: counts as music in the For You mix and
 * plays in-app from its 30s preview (meta.previewUrl).
 */
export function soundtrackFeedItems(soundtrack: Soundtrack): FeedItem[] {
  return soundtrack.tracks.map((track) => ({
    id: `soundtrack:${track.id}`,
    source: "spotify" as const,
    type: "track" as const,
    title: track.title,
    subtitle: track.artist,
    imageUrl: track.artworkUrl,
    url: track.spotifyUrl,
    publishedAt: null,
    score: 1,
    meta: {
      previewUrl: track.previewUrl,
      appleUrl: track.appleUrl,
      niche: soundtrack.slug,
      soundtrack: soundtrack.title,
    },
  }))
}
