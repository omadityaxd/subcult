import { getDb } from "@/db"
import { createAlertsRepository } from "@/db/alerts-repository"
import { isAuthorizedBearer } from "@/lib/admin-auth"
import { runAlerts } from "@/lib/alerts/run"
import { env } from "@/lib/env"
import { errorMessage, log } from "@/lib/log"
import { apiError, apiOk } from "@/lib/request"

export const maxDuration = 300

/**
 * Vercel Cron, daily at 14:00 UTC; on Hobby it fires any time up to 14:59.
 * That is outside the default quiet hours (23:00–09:00 local) from the US
 * East coast to India, but inside them on the US West coast (07:00), where
 * people are skipped. Grail hunts, drops, niche momentum, then at most one
 * batched push per person.
 */
export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedBearer(request.headers.get("authorization"), env.CRON_SECRET)) {
    return apiError("unauthorized", 401)
  }
  const db = getDb()
  if (!db) return apiOk({ skipped: "DATABASE_URL not set" })
  try {
    return apiOk(await runAlerts(db, createAlertsRepository(db)))
  } catch (error) {
    log.error("cron.alerts.error", { error: errorMessage(error) })
    return apiError("alerts run failed", 500)
  }
}
