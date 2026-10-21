import "server-only"
import { getRedis } from "@/lib/redis"

/** "artist:rick-owens": only known entities are ever logged, never what someone typed. */
export type SearchedEntity = `${"niche" | "artist" | "brand"}:${string}`

const DAYS = 7
/** A term needs this many searches in a week to trend: no single person's query shows up. */
export const TRENDING_MIN = 5
const KEY = (day: string) => `subcult:search:${day}`
const dayOf = (offset: number) =>
  new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10)

/** Counts one search for a known entity (today's tally, kept for 8 days). */
export async function logSearch(entity: SearchedEntity): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  const key = KEY(dayOf(0))
  await redis.zincrby(key, 1, entity)
  await redis.expire(key, (DAYS + 1) * 86_400)
}

/** The week's most-searched entities with at least TRENDING_MIN searches, most first. */
export async function trendingSearches(
  limit = 6,
): Promise<{ entity: SearchedEntity; count: number }[]> {
  const redis = getRedis()
  if (!redis) return []
  const days = await Promise.all(
    Array.from({ length: DAYS }, (_, i) =>
      redis
        .zrange<(string | number)[]>(KEY(dayOf(i)), 0, -1, { withScores: true })
        .catch(() => [] as (string | number)[]),
    ),
  )
  const totals = new Map<string, number>()
  for (const flat of days) {
    for (let i = 0; i + 1 < flat.length; i += 2) {
      const member = String(flat[i])
      totals.set(member, (totals.get(member) ?? 0) + Number(flat[i + 1]))
    }
  }
  return [...totals]
    .filter(([, count]) => count >= TRENDING_MIN)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([entity, count]) => ({ entity: entity as SearchedEntity, count }))
}
