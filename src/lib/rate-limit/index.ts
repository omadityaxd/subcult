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

/** Preview lookups per IP per minute: generous for real taps, a wall for scrapers. */
export const PREVIEW_LOOKUPS_PER_MINUTE = 60

let previewLimiter: RateLimiter | undefined

export function getPreviewLimiter(): RateLimiter {
  if (previewLimiter) return previewLimiter
  const redis = getRedis()
  if (!redis) {
    previewLimiter = createMemoryLimiter(PREVIEW_LOOKUPS_PER_MINUTE, 60_000)
    return previewLimiter
  }
  const upstash = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(PREVIEW_LOOKUPS_PER_MINUTE, "1 m"),
    prefix: "subcult:rl:preview",
  })
  previewLimiter = {
    async limit(identifier) {
      try {
        const result = await upstash.limit(identifier)
        return { success: result.success, remaining: result.remaining, resetAt: result.reset }
      } catch (error) {
        // Fail open: previews are cached and cheap; a Redis blip shouldn't mute the app.
        log.warn("rate-limit.preview_error", { identifier, error: errorMessage(error) })
        return { success: true, remaining: 0, resetAt: Date.now() }
      }
    },
  }
  return previewLimiter
}
