import { sql } from "drizzle-orm"
import { getDb } from "@/db"
import { isAuthorizedBearer } from "@/lib/admin-auth"
import { env } from "@/lib/env"
import { errorMessage, log } from "@/lib/log"
import { apiError, apiOk } from "@/lib/request"

/**
 * Daily Vercel Cron: one cheap query so the Supabase free project never
 * pauses for inactivity. Vercel authenticates with `Bearer $CRON_SECRET`.
 */
export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedBearer(request.headers.get("authorization"), env.CRON_SECRET)) {
    return apiError("unauthorized", 401)
  }
  const db = getDb()
  if (!db) return apiError("DATABASE_URL not configured", 503)

  const startedAt = Date.now()
  try {
    await db.execute(sql`select slug from niches limit 1`)
    const ms = Date.now() - startedAt
    log.info("cron.keep-alive", { ms })
    return apiOk({ ok: true, ms })
  } catch (error) {
    log.error("cron.keep-alive.error", { error: errorMessage(error) })
    return apiError("database unreachable", 503)
  }
}
