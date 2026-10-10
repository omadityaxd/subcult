import type { Redis } from "@upstash/redis"

/** Minimal key/value store so caching works with Upstash or, locally, in memory. */
export interface CacheStore {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>
}

export function redisStore(redis: Redis): CacheStore {
  return {
    get: (key) => redis.get(key),
    async set(key, value, ttlSeconds) {
      await redis.set(key, value, { ex: ttlSeconds })
    },
  }
}

/** Per-process fallback when Redis isn't configured (dev / demo). */
export function memoryStore(now: () => number = Date.now): CacheStore {
  const entries = new Map<string, { value: unknown; expiresAt: number }>()
  return {
    async get(key) {
      const entry = entries.get(key)
      if (!entry) return null
      if (entry.expiresAt <= now()) {
        entries.delete(key)
        return null
      }
      return entry.value
    },
    async set(key, value, ttlSeconds) {
      entries.set(key, { value, expiresAt: now() + ttlSeconds * 1000 })
    },
  }
}

interface Envelope<T> {
  value: T
  fetchedAt: number
}

const isEnvelope = <T>(value: unknown): value is Envelope<T> =>
  typeof value === "object" &&
  value !== null &&
  "fetchedAt" in value &&
  typeof value.fetchedAt === "number" &&
  "value" in value

export type CacheState = "hit" | "miss" | "stale"

export interface CachePolicy {
  /** Serve without refetching for this long. */
  freshSeconds: number
  /** Keep (and serve on failure) for this long. */
  staleSeconds: number
}

export interface CacheEvents {
  onStoreError?: (operation: "get" | "set", error: unknown) => void
}

/**
 * Fresh → serve from cache. Expired → refetch and store. Refetch failed →
 * serve the stale copy if we still have one (stale-if-error), else throw.
 * A broken cache store never breaks a page: it just behaves like a miss.
 */
export async function cached<T>(
  store: CacheStore,
  key: string,
  policy: CachePolicy,
  load: () => Promise<T>,
  { now = Date.now, onStoreError }: CacheEvents & { now?: () => number } = {},
): Promise<{ value: T; state: CacheState; fetchedAt: number }> {
  let existing: Envelope<T> | null = null
  try {
    const raw = await store.get(key)
    existing = isEnvelope<T>(raw) ? raw : null
  } catch (error) {
    onStoreError?.("get", error)
  }

  if (existing && now() - existing.fetchedAt < policy.freshSeconds * 1000) {
    return { value: existing.value, state: "hit", fetchedAt: existing.fetchedAt }
  }

  try {
    const value = await load()
    const fetchedAt = now()
    try {
      await store.set(key, { value, fetchedAt } satisfies Envelope<T>, policy.staleSeconds)
    } catch (error) {
      onStoreError?.("set", error)
    }
    return { value, state: "miss", fetchedAt }
  } catch (error) {
    if (existing) return { value: existing.value, state: "stale", fetchedAt: existing.fetchedAt }
    throw error
  }
}
