import "server-only"
import { env } from "@/lib/env"
import { type CacheStore, memoryStore, redisStore } from "@/lib/feed/cache"
import { getRedis } from "@/lib/redis"
import { SPOTIFY_BREAKER_KEY } from "@/lib/feed/server"
import { redisBreaker } from "@/lib/sources/redis-breaker"
import { type SpotifyClient, createSpotifyClient } from "@/lib/sources/spotify"

let spotify: SpotifyClient | null | undefined
const localStore = memoryStore()

/** One Spotify client per process (shares its token), or null without keys. */
export function getSpotify(): SpotifyClient | null {
  if (spotify !== undefined) return spotify
  const redis = getRedis()
  spotify =
    env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET
      ? createSpotifyClient({
          clientId: env.SPOTIFY_CLIENT_ID,
          clientSecret: env.SPOTIFY_CLIENT_SECRET,
          breaker: redis ? redisBreaker(redis, SPOTIFY_BREAKER_KEY) : undefined,
        })
      : null
  return spotify
}

/** Upstash when configured, else a per-process memory store. */
export function getCacheStore(): CacheStore {
  const redis = getRedis()
  return redis ? redisStore(redis) : localStore
}
