export interface RateLimitResult {
  success: boolean
  remaining: number
  /** Epoch ms when the oldest counted hit expires. */
  resetAt: number
}

export interface RateLimiter {
  limit(identifier: string): Promise<RateLimitResult>
}

/**
 * Sliding-window limiter held in process memory. Dev/demo fallback only:
 * serverless instances don't share it, so production should use Upstash.
 */
export function createMemoryLimiter(
  max: number,
  windowMs: number,
  now: () => number = Date.now,
): RateLimiter {
  const hits = new Map<string, number[]>()

  return {
    async limit(identifier) {
      const current = now()
      const recent = (hits.get(identifier) ?? []).filter((at) => current - at < windowMs)
      const success = recent.length < max
      const next = success ? [...recent, current] : recent
      hits.set(identifier, next)
      return {
        success,
        remaining: Math.max(0, max - next.length),
        resetAt: (next[0] ?? current) + windowMs,
      }
    },
  }
}
