import type { Redis } from "@upstash/redis"
import type { RateLimitBreaker } from "./spotify"

/** A rate-limit block shared by every serverless instance (expires with the block). */
export function redisBreaker(redis: Redis, key: string): RateLimitBreaker {
  return {
    async blockedUntil() {
      try {
        return Number(await redis.get(key)) || 0
      } catch {
        return 0 // A broken cache never blocks requests on its own.
      }
    },
    async trip(untilMs) {
      const seconds = Math.ceil((untilMs - Date.now()) / 1000)
      if (seconds <= 0) return
      try {
        await redis.set(key, untilMs, { ex: seconds })
      } catch {
        // Best effort: the in-flight caller still gets the rate-limit error.
      }
    },
  }
}
