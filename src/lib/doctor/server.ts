import "server-only"
import { sql } from "drizzle-orm"
import { getDb } from "@/db"
import { summarizeUsage } from "@/db/usage-repository"
import { startOfUtcDay } from "@/lib/engine/usage"
import { env } from "@/lib/env"
import { DEFAULT_YOUTUBE_DAILY_SEARCHES } from "@/lib/feed/server"
import { getRedis } from "@/lib/redis"
import { type Probe, type ServiceRow, checkServices } from "./services"

const utcDay = () => new Date().toISOString().slice(0, 10)

async function pingDatabase(): Promise<Probe> {
  const db = getDb()
  if (!db) return { reachable: false, detail: "no database client" }
  await db.execute(sql`select 1`)
  return { reachable: true, detail: "select 1" }
}

/** Quota left today from our own counters (the services don't report these). */
async function quotasLeft(): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const redis = getRedis()
  if (redis && env.YOUTUBE_API_KEY) {
    const used = Number((await redis.get<number>(`subcult:yt:searches:${utcDay()}`)) ?? 0)
    out.youtube = `${Math.max(0, DEFAULT_YOUTUBE_DAILY_SEARCHES - used)}/${DEFAULT_YOUTUBE_DAILY_SEARCHES} searches today`
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
