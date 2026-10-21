import "server-only"
import { sql } from "drizzle-orm"
import { getDb } from "@/db"
import { summarizeUsage } from "@/db/usage-repository"
import { startOfUtcDay } from "@/lib/engine/usage"
import { env } from "@/lib/env"
import { DEFAULT_YOUTUBE_DAILY_SEARCHES } from "@/lib/feed/server"
import { getRedis } from "@/lib/redis"
import { EBAY_DAILY_CALLS } from "@/lib/shop/quota"
import { type Probe, type ServiceRow, checkServices } from "./services"

const utcDay = () => new Date().toISOString().slice(0, 10)

async function pingDatabase(): Promise<Probe> {
  const db = getDb()
  if (!db) return { reachable: false, detail: "no database client" }
  await db.execute(sql`select 1`)
  return { reachable: true, detail: "select 1" }
}

/** Quota left today from our own counters (the services don't report these). */
export async function quotasLeft(): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const redis = getRedis()
  if (redis && env.YOUTUBE_API_KEY) {
    const used = Number((await redis.get<number>(`subcult:yt:searches:${utcDay()}`)) ?? 0)
    out.youtube = `${Math.max(0, DEFAULT_YOUTUBE_DAILY_SEARCHES - used)}/${DEFAULT_YOUTUBE_DAILY_SEARCHES} searches today`
  }
  if (redis && env.EBAY_CLIENT_ID) {
    const used = Number((await redis.get<number>(`subcult:ebay:calls:${utcDay()}`)) ?? 0)
    out.ebay = `${Math.max(0, EBAY_DAILY_CALLS - used)}/${EBAY_DAILY_CALLS} calls today`
  }
  const db = getDb()
  if (db && env.ANTHROPIC_API_KEY) {
    const usage = await summarizeUsage(db, { startOfToday: startOfUtcDay() })
    out.anthropic = [
      `${Math.max(0, env.VISION_DAILY_BATCH_CAP - usage.visionBatchesToday)}/${env.VISION_DAILY_BATCH_CAP} vision batches`,
      `${Math.max(0, env.LLM_DAILY_GENERATION_CAP - usage.generationsToday)}/${env.LLM_DAILY_GENERATION_CAP} generations`,
    ].join(", ")
  }
  return out
}

/** The full status table, as `pnpm doctor` and /admin/status show it. */
export async function serviceStatus(): Promise<ServiceRow[]> {
  const quotas = await quotasLeft().catch((): Record<string, string> => ({}))
  return checkServices(process.env, { extraProbes: { database: pingDatabase }, quotas })
}

export interface CostCap {
  service: string
  what: string
  cap: string
  /** Today's usage against the cap, when the service is on. */
  left: string | null
}

/**
 * Every paid or quota-limited call and the cap it goes through: listed on
 * /admin/status so nothing spends without a ceiling.
 */
export async function costCaps(): Promise<CostCap[]> {
  const left = await quotasLeft().catch((): Record<string, string> => ({}))
  return [
    {
      service: "Anthropic",
      what: "New niche generations (plus a per-IP limit)",
      cap: `${env.LLM_DAILY_GENERATION_CAP} a day (LLM_DAILY_GENERATION_CAP)`,
      left: left.anthropic?.split(", ")[1] ?? null,
    },
    {
      service: "Anthropic",
      what: "Vision tagging batches (up to 6 images each)",
      cap: `${env.VISION_DAILY_BATCH_CAP} a day (VISION_DAILY_BATCH_CAP)`,
      left: left.anthropic?.split(", ")[0] ?? null,
    },
    {
      service: "YouTube Data API",
      what: "Searches (100 quota units each; 10,000 units a day)",
      cap: `${DEFAULT_YOUTUBE_DAILY_SEARCHES} a day`,
      left: left.youtube ?? null,
    },
    {
      service: "eBay Browse API",
      what: "All calls (search, item); eBay's default is 5,000 a day",
      cap: `${EBAY_DAILY_CALLS} a day`,
      left: left.ebay ?? null,
    },
    {
      service: "iTunes Search",
      what: "Preview lookups (free; Apple throttles at ~20 a minute)",
      cap: "60 a minute per IP, misses cached a day",
      left: null,
    },
    {
      service: "Unsplash / Pexels",
      what: "Moodboard photo searches",
      cap: "cached per niche; Unsplash 50/hour demo, Pexels 200/hour",
      left: null,
    },
  ]
}
