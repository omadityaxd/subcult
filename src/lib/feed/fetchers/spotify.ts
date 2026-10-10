import { z } from "zod"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import type { FeedItem, Fetcher } from "../types"

/**
 * Spotify Web API, Client Credentials + /search only. Since the Feb 2026
 * dev-mode changes, search is capped at limit=10 and recommendations, related
 * artists, top tracks, new releases and browse categories are unavailable.
 */
const PLAYLIST_LIMIT = 6 // ≤ 10 (dev-mode cap)
const TRACKS_PER_ARTIST = 2
const QUERIES_USED = 2
const ARTISTS_LOOKED_UP = 4
const TOKEN_REFRESH_MARGIN_MS = 60_000

const imageSchema = z.object({ url: z.string() })
const urlsSchema = z.object({ spotify: z.string() })

const trackSchema = z.object({
  id: z.string(),
  name: z.string(),
  external_urls: urlsSchema,
  artists: z.array(z.object({ name: z.string() })),
  album: z.object({
    name: z.string(),
    images: z.array(imageSchema).default([]),
    release_date: z.string().optional(),
  }),
})
const playlistSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  external_urls: urlsSchema,
  images: z.array(imageSchema).nullish(),
  owner: z.object({ display_name: z.string().nullish() }).nullish(),
})
const artistSchema = z.object({
  id: z.string(),
  name: z.string(),
  external_urls: urlsSchema,
  images: z.array(imageSchema).nullish(),
})

// Spotify sometimes returns null entries in playlist results; tolerate them.
export const searchResponseSchema = z.object({
  tracks: z.object({ items: z.array(trackSchema.nullable()) }).optional(),
  playlists: z.object({ items: z.array(playlistSchema.nullable()) }).optional(),
  artists: z.object({ items: z.array(artistSchema.nullable()) }).optional(),
})
export type SpotifySearchResponse = z.infer<typeof searchResponseSchema>

const tokenSchema = z.object({ access_token: z.string(), expires_in: z.number() })

const compact = <T>(items: readonly (T | null)[] | undefined): T[] =>
  (items ?? []).filter((item): item is T => item !== null)

/** Release dates come as YYYY, YYYY-MM or YYYY-MM-DD. */
function releaseDate(value: string | undefined): string | null {
  if (!value) return null
  const date = new Date(value.length === 4 ? `${value}-01-01` : value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

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

interface SpotifyOptions {
  clientId: string
  clientSecret: string
  fetchImpl?: typeof fetch
  market?: string
}

export function spotifyFetcher({
  clientId,
  clientSecret,
  fetchImpl = fetch,
  market = "US",
}: SpotifyOptions): Fetcher {
  let token: { value: string; expiresAt: number } | null = null
  // Parallel searches must share one token request, not each start their own.
  let pending: Promise<string> | null = null

  function accessToken(): Promise<string> {
    if (token && token.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()) {
      return Promise.resolve(token.value)
    }
    pending ??= requestToken().finally(() => {
      pending = null
    })
    return pending
  }

  async function requestToken(): Promise<string> {
    const response = await fetchImpl("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    })
    if (!response.ok) throw new Error(`Spotify token ${response.status}`)
    const parsed = tokenSchema.parse(await response.json())
    token = { value: parsed.access_token, expiresAt: Date.now() + parsed.expires_in * 1000 }
    return token.value
  }

  async function search(q: string, type: string, limit: number): Promise<FeedItem[]> {
    const params = new URLSearchParams({ q, type, limit: String(limit), market })
    const response = await fetchImpl(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${await accessToken()}` },
    })
    if (!response.ok) throw new Error(`Spotify search ${response.status} for "${q}"`)
    const parsed = searchResponseSchema.safeParse(await response.json())
    if (!parsed.success) throw new Error("Unexpected Spotify search response shape")
    return mapSearchResponse(parsed.data)
  }

  return {
    source: "spotify",
    freshSeconds: 24 * 3600,
    staleSeconds: 7 * 24 * 3600,
    async fetch(profile: NicheProfile) {
      const requests = [
        ...profile.spotifyQueries
          .slice(0, QUERIES_USED)
          .map((query) => search(query, "playlist", PLAYLIST_LIMIT)),
        ...profile.artists
          .slice(0, ARTISTS_LOOKED_UP)
          // Tracks come from the curated artists: generic query track search is noisy.
          .map((artist) => search(`artist:"${artist.name}"`, "artist,track", TRACKS_PER_ARTIST)),
      ]
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
