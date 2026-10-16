import type { NicheProfile } from "@/lib/engine/profile-schema"
import {
  type SpotifyClient,
  type SpotifyClientOptions,
  type SpotifySearchResponse,
  createSpotifyClient,
} from "@/lib/sources/spotify"
import type { FeedItem, Fetcher } from "../types"

/**
 * Niche feed from Spotify search (see lib/sources/spotify for the API limits).
 * Tracks by verified artists only: since February 2026 other people's
 * playlists return metadata without their tracks, so we don't surface them.
 */
const TRACKS_PER_ARTIST = 2
const ARTISTS_LOOKED_UP = 4

const compact = <T>(items: readonly (T | null)[] | undefined): T[] =>
  (items ?? []).filter((item): item is T => item !== null)

/** Release dates come as YYYY, YYYY-MM or YYYY-MM-DD. */
function releaseDate(value: string | undefined): string | null {
  if (!value) return null
  const date = new Date(value.length === 4 ? `${value}-01-01` : value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export { searchResponseSchema } from "@/lib/sources/spotify"

export function mapSearchResponse(response: SpotifySearchResponse): FeedItem[] {
  const base = { source: "spotify" as const, score: 0 }
  const tracks = compact(response.tracks?.items).map((track): FeedItem => ({
    ...base,
    id: `spotify:track:${track.id}`,
    type: "track",
    title: track.name,
    subtitle: track.artists.map((artist) => artist.name).join(", "),
    imageUrl: track.album.images[0]?.url ?? null,
    url: track.external_urls.spotify,
    publishedAt: releaseDate(track.album.release_date),
    meta: { embedUrl: `https://open.spotify.com/embed/track/${track.id}`, album: track.album.name },
  }))
  const playlists = compact(response.playlists?.items).map((playlist): FeedItem => ({
    ...base,
    id: `spotify:playlist:${playlist.id}`,
    type: "playlist",
    title: playlist.name,
    subtitle: playlist.owner?.display_name ? `by ${playlist.owner.display_name}` : null,
    imageUrl: playlist.images?.[0]?.url ?? null,
    url: playlist.external_urls.spotify,
    publishedAt: null,
    meta: { embedUrl: `https://open.spotify.com/embed/playlist/${playlist.id}` },
  }))
  const artists = compact(response.artists?.items).map((artist): FeedItem => ({
    ...base,
    id: `spotify:artist:${artist.id}`,
    type: "artist",
    title: artist.name,
    // The card already labels the type; no "artist · artist".
    subtitle: null,
    imageUrl: artist.images?.[0]?.url ?? null,
    url: artist.external_urls.spotify,
    publishedAt: null,
    meta: { embedUrl: `https://open.spotify.com/embed/artist/${artist.id}` },
  }))
  return [...tracks, ...playlists, ...artists]
}

interface SpotifyOptions extends SpotifyClientOptions {
  client?: SpotifyClient
  /** Verified Spotify ID for a curated artist name, when the taxonomy knows it. */
  artistIdFor?: (name: string) => string | undefined
}

/** Keep only the tracks (and artist card) that belong to this exact Spotify artist. */
export function onlyArtist(
  response: SpotifySearchResponse,
  artistId: string,
): SpotifySearchResponse {
  return {
    ...response,
    tracks: response.tracks && {
      items: response.tracks.items
        .filter((track) => track?.artists.some((artist) => artist.id === artistId))
        .slice(0, TRACKS_PER_ARTIST),
    },
    artists: response.artists && {
      items: response.artists.items.filter((artist) => artist?.id === artistId).slice(0, 1),
    },
  }
}

export function spotifyFetcher({ client, artistIdFor, ...options }: SpotifyOptions): Fetcher {
  const spotify = client ?? createSpotifyClient(options)

  /**
   * Verified artists: plain-name search filtered to their Spotify ID (the
   * artist:"…" filter is fuzzy and leaks unrelated tracks). Unverified names
   * keep the filtered query as a best effort.
   */
  async function artistItems(name: string): Promise<FeedItem[]> {
    const id = artistIdFor?.(name)
    if (!id) return search(`artist:"${name}"`, "artist,track", TRACKS_PER_ARTIST)
    return mapSearchResponse(onlyArtist(await spotify.search(name, "artist,track", 10), id))
  }

  async function search(q: string, type: string, limit: number): Promise<FeedItem[]> {
    return mapSearchResponse(await spotify.search(q, type, limit))
  }

  return {
    source: "spotify",
    freshSeconds: 24 * 3600,
    staleSeconds: 7 * 24 * 3600,
    async fetch(profile: NicheProfile) {
      // Tracks come from the curated artists: generic query search is noisy.
      const requests = profile.artists
        .slice(0, ARTISTS_LOOKED_UP)
        .map((artist) => artistItems(artist.name))
      const settled = await Promise.allSettled(requests)
      const results = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      if (results.length === 0) {
        const firstError = settled.find((r) => r.status === "rejected")
        throw firstError?.status === "rejected"
          ? firstError.reason
          : new Error("Spotify: no results")
      }
      const seen = new Set<string>()
      return results.filter((item) => !seen.has(item.id) && seen.add(item.id))
    },
  }
}
