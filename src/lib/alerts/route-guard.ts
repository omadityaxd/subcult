import "server-only"
import { getDb } from "@/db"
import { type AlertsRepository, createAlertsRepository } from "@/db/alerts-repository"
import { sameOrigin } from "@/lib/fits/route-helpers"
import { getLimiter } from "@/lib/rate-limit"
import { apiError } from "@/lib/request"
import { type Viewer, getViewer } from "@/lib/supabase/server"

/**
 * Shared guard for alert routes: same-origin for writes, signed in (alerts
 * need an account), database up, rate-limited per user.
 */
export async function alertsContext(
  request: Request,
  { write }: { write: boolean },
): Promise<{ viewer: Viewer; repo: AlertsRepository } | Response> {
  if (write && !sameOrigin(request)) return apiError("cross-site request refused", 403, "forbidden")
  const viewer = await getViewer()
  if (!viewer) return apiError("sign in to get alerts", 401, "unauthenticated")
  const db = getDb()
  if (!db) return apiError("alerts aren't available", 503, "unavailable")
  const limit = await getLimiter("alerts", 120, "10 m").limit(viewer.id)
  if (!limit.success) return apiError("slow down a little", 429, "rate-limited")
  return { viewer, repo: createAlertsRepository(db) }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
