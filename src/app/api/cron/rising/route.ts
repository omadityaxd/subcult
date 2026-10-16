import { isAuthorizedBearer } from "@/lib/admin-auth"
import { env } from "@/lib/env"
import { errorMessage, log } from "@/lib/log"
import { apiError, apiOk } from "@/lib/request"
import { computeRisingSnapshot, saveRisingSnapshot } from "@/lib/rising/server"

/** Vercel Hobby allows 300s; ~64 niches × 3 searches at 4 workers fits well inside. */
export const maxDuration = 300

/** Vercel Cron, daily: recompute what's rising (5 weeks of dated events) and cache it. */
export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedBearer(request.headers.get("authorization"), env.CRON_SECRET)) {
    return apiError("unauthorized", 401)
  }
  try {
    const snapshot = await computeRisingSnapshot()
    await saveRisingSnapshot(snapshot)
    return apiOk({
      rising: snapshot.entities.length,
      sources: snapshot.sources,
      top: snapshot.entities.slice(0, 10).map((m) => `${m.label} ${m.score.toFixed(2)}`),
    })
  } catch (error) {
    log.error("cron.rising.error", { error: errorMessage(error) })
    return apiError("rising refresh failed", 500)
  }
}
