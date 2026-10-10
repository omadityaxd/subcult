import { z } from "zod"

/**
 * Spotify Web API, Client Credentials + /search only. Since the Feb 2026
 * dev-mode changes, search is capped at limit=10 and recommendations, related
 * artists, top tracks, new releases and browse categories are unavailable.
 * `preview_url` is absent for apps registered after Nov 2024 (audio previews
 * come from iTunes instead; see lib/music).
 */
const TOKEN_REFRESH_MARGIN_MS = 60_000
export const SPOTIFY_SEARCH_MAX_LIMIT = 10

const imageSchema = z.object({ url: z.string() })
const urlsSchema = z.object({ spotify: z.string() })

const trackSchema = z.object({
  id: z.string(),
  name: z.string(),
  external_urls: urlsSchema,
  artists: z.array(z.object({ id: z.string().optional(), name: z.string() })),
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

/** Spotify answered 429. Dev-mode bans can last most of a day, so callers must back off. */
export class SpotifyRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super(`Spotify rate limited for ${retryAfterSeconds}s`)
    this.name = "SpotifyRateLimitError"
  }
}

/**
 * Remembers a 429 so nothing calls Spotify again until it's lifted: hammering
 * a rate-limited dev-mode app extends the ban. Share it (e.g. via Redis) so
 * every serverless instance honours the same block.
 */
export interface RateLimitBreaker {
  blockedUntil(): Promise<number>
  trip(untilMs: number): Promise<void>
}

export function memoryBreaker(): RateLimitBreaker {
  let until = 0
  return {
    blockedUntil: async () => until,
    trip: async (next) => {
      until = Math.max(until, next)
    },
  }
}

const DEFAULT_RETRY_AFTER_SECONDS = 60

export interface SpotifyClientOptions {
  clientId: string
  clientSecret: string
  fetchImpl?: typeof fetch
  market?: string
  breaker?: RateLimitBreaker
  now?: () => number
}

export interface SpotifyClient {
  search(q: string, type: string, limit: number): Promise<SpotifySearchResponse>
}

export function createSpotifyClient({
  clientId,
  clientSecret,
  fetchImpl = fetch,
  market = "US",
  breaker = memoryBreaker(),
  now = Date.now,
}: SpotifyClientOptions): SpotifyClient {
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

  return {
    async search(q, type, limit) {
      const blockedUntil = await breaker.blockedUntil()
      if (blockedUntil > now()) {
        throw new SpotifyRateLimitError(Math.ceil((blockedUntil - now()) / 1000))
      }
      const params = new URLSearchParams({
        q,
        type,
        limit: String(Math.min(limit, SPOTIFY_SEARCH_MAX_LIMIT)),
        market,
      })
      const response = await fetchImpl(`https://api.spotify.com/v1/search?${params}`, {
        headers: { Authorization: `Bearer ${await accessToken()}` },
      })
      if (response.status === 429) {
        const retryAfter =
          Number(response.headers.get("retry-after")) || DEFAULT_RETRY_AFTER_SECONDS
        await breaker.trip(now() + retryAfter * 1000)
        throw new SpotifyRateLimitError(retryAfter)
      }
      if (!response.ok) throw new Error(`Spotify search ${response.status} for "${q}"`)
      const parsed = searchResponseSchema.safeParse(await response.json())
      if (!parsed.success) throw new Error("Unexpected Spotify search response shape")
      return parsed.data
    },
  }
}
