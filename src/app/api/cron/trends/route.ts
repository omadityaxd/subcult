import { getDb } from "@/db"
import { isAuthorizedBearer } from "@/lib/admin-auth"
import { env } from "@/lib/env"
import { errorMessage, log } from "@/lib/log"
import { apiError, apiOk } from "@/lib/request"
import { runTrendRefresh } from "@/lib/trends/refresh"
import { createTrendDeps, parseTrendSettings } from "@/lib/trends/server"

/** Vercel Hobby allows 300s; the pipeline's own deadline (240s) stays under it. */
export const maxDuration = 300

/**
 * Vercel Cron, 1st and 15th of the month (`0 9 1,15 * *`). No-ops cleanly
 * without ANTHROPIC_API_KEY or a database.
 */
export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedBearer(request.headers.get("authorization"), env.CRON_SECRET)) {
    return apiError("unauthorized", 401)
  }
  if (!env.ANTHROPIC_API_KEY) return apiOk({ skipped: "ANTHROPIC_API_KEY not set" })
  const db = getDb()
  if (!db) return apiOk({ skipped: "DATABASE_URL not set" })

  try {
    const deps = await createTrendDeps(db, parseTrendSettings(process.env), log)
    const report = await runTrendRefresh(deps)
    return apiOk({
      created: report.created,
      refreshed: report.refreshed,
      archived: report.archived,
      rejected: report.proposals.filter((p) => !p.accepted).map((p) => `${p.name}: ${p.reason}`),
      failures: report.failures,
      abortedReason: report.abortedReason,
      spentUsd: report.spentUsd,
    })
  } catch (error) {
    log.error("cron.trends.error", { error: errorMessage(error) })
    return apiError("trend refresh failed", 500)
  }
}
