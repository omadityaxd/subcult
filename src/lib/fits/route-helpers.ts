import "server-only"
import { z } from "zod"
import { getDb } from "@/db"
import type { Database } from "@/db/create-db"
import { getFit } from "@/db/fit-repository"
import { getLimiter } from "@/lib/rate-limit"
import { apiError } from "@/lib/request"
import { type Viewer, getViewer } from "@/lib/supabase/server"

const fitId = z.string().uuid()

/**
 * CSRF guard for state-changing routes: the browser's Origin (or, failing
 * that, Sec-Fetch-Site) must say the request came from our own pages.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")
  if (origin) {
    try {
      return new URL(origin).host === new URL(request.url).host
    } catch {
      return false
    }
  }
  const site = request.headers.get("sec-fetch-site")
  return site === null || site === "same-origin" || site === "none"
}

/**
 * Shared guard for per-fit actions: same-origin, signed in, database up,
 * rate limit, and a fit that exists and is visible (or the viewer's own).
 */
export async function fitAction(
  request: Request,
  params: Promise<{ id: string }>,
  limiter: { name: string; max: number; window: `${number} ${"m" | "h" | "d"}` },
): Promise<{ viewer: Viewer; db: Database; id: string } | { error: Response }> {
  if (!sameOrigin(request))
    return { error: apiError("cross-site request refused", 403, "forbidden") }
  const viewer = await getViewer()
  if (!viewer) return { error: apiError("sign in first", 401, "unauthenticated") }
  const db = getDb()
  if (!db) return { error: apiError("not available right now", 503, "unavailable") }
  const { id } = await params
  if (!fitId.safeParse(id).success) return { error: apiError("no such fit", 404, "invalid-input") }
  const limit = await getLimiter(limiter.name, limiter.max, limiter.window, {
    durable: true,
  }).limit(viewer.id)
  if (!limit.success) return { error: apiError("slow down a little", 429, "rate-limited") }
  const fit = await getFit(db, id).catch(() => null)
  if (!fit || (fit.status !== "visible" && fit.userId !== viewer.id)) {
    return { error: apiError("no such fit", 404, "invalid-input") }
  }
  return { viewer, db, id }
}
