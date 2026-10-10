import type { Redis } from "@upstash/redis"

/** Shared daily allowance for a metered API (e.g. YouTube's 10k units/day). */
export interface QuotaGuard {
  /** Consumes one unit; false when today's allowance is spent. */
  tryConsume(): Promise<boolean>
}

export class QuotaExhaustedError extends Error {
  constructor(name: string) {
    super(`${name} daily quota exhausted`)
    this.name = "QuotaExhaustedError"
  }
}

const DAY_SECONDS = 86_400
const utcDay = (now: Date) => now.toISOString().slice(0, 10)

/** Atomic INCR per UTC day, shared by every serverless instance. */
export function redisQuota(
  redis: Redis,
  name: string,
  perDay: number,
  now = () => new Date(),
): QuotaGuard {
  return {
    async tryConsume() {
      const key = `subcult:${name}:${utcDay(now())}`
      const used = await redis.incr(key)
      if (used === 1) await redis.expire(key, DAY_SECONDS * 2)
      return used <= perDay
    },
  }
}

/** Per-process fallback (dev): good enough to stop a runaway loop. */
export function memoryQuota(perDay: number, now = () => new Date()): QuotaGuard {
  const used = new Map<string, number>()
  return {
    async tryConsume() {
      const day = utcDay(now())
      const next = (used.get(day) ?? 0) + 1
      used.set(day, next)
      return next <= perDay
    },
  }
}
