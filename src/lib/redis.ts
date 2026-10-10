import "server-only"
import { Redis } from "@upstash/redis"
import { env } from "@/lib/env"

let client: Redis | null | undefined

/** Shared Upstash client, or null when Redis isn't configured. */
export function getRedis(): Redis | null {
  if (client !== undefined) return client
  client =
    env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
      ? new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
      : null
  return client
}
