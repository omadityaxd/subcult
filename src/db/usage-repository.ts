import { and, desc, eq, gte, sql } from "drizzle-orm"
import type { UsageLog, UsagePurpose } from "../lib/engine/usage"
import type { Database } from "./create-db"
import { type LlmUsageRow, llmUsage } from "./schema"

export function createUsageLog(db: Database): UsageLog {
  return {
    async record(entry) {
      await db.insert(llmUsage).values(entry)
    },

    async countSince(purpose, since) {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(llmUsage)
        .where(and(eq(llmUsage.purpose, purpose), gte(llmUsage.createdAt, since)))
      return row?.count ?? 0
    },

    async costSince(purpose, since) {
      const [row] = await db
        .select({ cost: sql<number>`coalesce(sum(${llmUsage.costUsd}), 0)::float8` })
        .from(llmUsage)
        .where(and(eq(llmUsage.purpose, purpose), gte(llmUsage.createdAt, since)))
      return row?.cost ?? 0
    },
  }
}

export interface UsageTotals {
  jobs: number
  inputTokens: number
  outputTokens: number
  costUsd: number
}

async function totalsSince(db: Database, since: Date | null): Promise<UsageTotals> {
  const [row] = await db
    .select({
      jobs: sql<number>`count(*)::int`,
      inputTokens: sql<number>`coalesce(sum(${llmUsage.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${llmUsage.outputTokens}), 0)::int`,
      costUsd: sql<number>`coalesce(sum(${llmUsage.costUsd}), 0)::float8`,
    })
    .from(llmUsage)
    .where(since ? gte(llmUsage.createdAt, since) : undefined)
  return row ?? { jobs: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 }
}

export interface PurposeTotals {
  purpose: UsagePurpose
  jobs: number
  costUsd: number
}

export interface UsageSummary {
  today: UsageTotals
  last7Days: UsageTotals
  allTime: UsageTotals
  generationsToday: number
  visionBatchesToday: number
  /** Per-feature spend over the last 7 days, most expensive first. */
  byPurpose: PurposeTotals[]
  recent: LlmUsageRow[]
}

async function purposeTotalsSince(db: Database, since: Date): Promise<PurposeTotals[]> {
  return db
    .select({
      purpose: llmUsage.purpose,
      jobs: sql<number>`count(*)::int`,
      costUsd: sql<number>`coalesce(sum(${llmUsage.costUsd}), 0)::float8`,
    })
    .from(llmUsage)
    .where(gte(llmUsage.createdAt, since))
    .groupBy(llmUsage.purpose)
    .orderBy(desc(sql`3`))
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Everything /admin/usage shows, in one round of parallel queries. */
export async function summarizeUsage(
  db: Database,
  { startOfToday, recentLimit = 40 }: { startOfToday: Date; recentLimit?: number },
): Promise<UsageSummary> {
  const generation: UsagePurpose = "niche-generation"
  const weekAgo = new Date(startOfToday.getTime() - 6 * DAY_MS)
  const log = createUsageLog(db)
  const [today, last7Days, allTime, generationsToday, visionBatchesToday, byPurpose, recent] =
    await Promise.all([
      totalsSince(db, startOfToday),
      totalsSince(db, weekAgo),
      totalsSince(db, null),
      log.countSince(generation, startOfToday),
      log.countSince("vision-tag", startOfToday),
      purposeTotalsSince(db, weekAgo),
      db.select().from(llmUsage).orderBy(desc(llmUsage.createdAt)).limit(recentLimit),
    ])
  return {
    today,
    last7Days,
    allTime,
    generationsToday,
    visionBatchesToday,
    byPurpose,
    recent,
  }
}
