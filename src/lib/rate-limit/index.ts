import "server-only"
import { Ratelimit } from "@upstash/ratelimit"
import { errorMessage, log } from "@/lib/log"
import { getRedis } from "@/lib/redis"
import { type RateLimiter, createMemoryLimiter } from "./memory-limiter"

export type { RateLimitResult, RateLimiter } from "./memory-limiter"

/** New LLM-generated niches allowed per identifier (IP now, user id once auth lands). */
export const NICHE_GENERATIONS_PER_DAY = 10
const DAY_MS = 24 * 60 * 60 * 1000

let nicheLimiter: RateLimiter | undefined

export function getNicheGenerationLimiter(): RateLimiter {
  if (nicheLimiter) return nicheLimiter

  const redis = getRedis()
  if (!redis) {
    log.warn("rate-limit.memory-fallback", { reason: "UPSTASH_REDIS_* not set" })
    nicheLimiter = createMemoryLimiter(NICHE_GENERATIONS_PER_DAY, DAY_MS)
    return nicheLimiter
  }

  const upstash = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(NICHE_GENERATIONS_PER_DAY, "1 d"),
    prefix: "subcult:rl:niche-gen",
  })
  nicheLimiter = {
    async limit(identifier) {
      try {
        const result = await upstash.limit(identifier)
        return { success: result.success, remaining: result.remaining, resetAt: result.reset }
      } catch (error) {
        // Fail closed: if we can't count, we don't spend LLM tokens.
        log.error("rate-limit.error", { identifier, error: errorMessage(error) })
        return { success: false, remaining: 0, resetAt: Date.now() }
      }
    },
  }
  return nicheLimiter
}
