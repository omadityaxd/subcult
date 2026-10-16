import { z } from "zod"
import { getDb } from "@/db"
import { createTasteRepository } from "@/db/taste-repository"
import { sameOrigin } from "@/lib/fits/route-helpers"
import { errorMessage, log } from "@/lib/log"
import { getLimiter } from "@/lib/rate-limit"
import { apiError, apiOk } from "@/lib/request"
import { getViewer } from "@/lib/supabase/server"
import { type Signal, signalSchema } from "@/lib/taste/model"

const MAX_BATCH = 500
/** Signals can't claim to be from the future (clock skew allowance). */
const FUTURE_SLACK_MS = 5 * 60_000

const bodySchema = z.object({ signals: z.array(signalSchema).max(MAX_BATCH) })

async function guard(request: Request, write: boolean) {
  if (write && !sameOrigin(request)) return apiError("cross-site request refused", 403, "forbidden")
  const viewer = await getViewer()
  if (!viewer) return apiError("sign in first", 401, "unauthenticated")
  const db = getDb()
  if (!db) return apiError("taste sync isn't available", 503, "unavailable")
  const limit = await getLimiter("taste", 60, "1 h").limit(viewer.id)
  if (!limit.success) return apiError("slow down a little", 429, "rate-limited")
  return { viewer, repo: createTasteRepository(db) }
}

/** GET /api/taste → the signed-in user's recent signals (for merging into this device). */
export async function GET(request: Request): Promise<Response> {
  const ctx = await guard(request, false)
  if (ctx instanceof Response) return ctx
  try {
    return apiOk({ signals: await ctx.repo.recent(ctx.viewer.id) })
  } catch (error) {
    log.error("taste.read_failed", { error: errorMessage(error) })
    return apiError("couldn't load your taste", 500, "server-error")
  }
}

/** POST /api/taste { signals } → stores this device's new signals on the account. */
export async function POST(request: Request): Promise<Response> {
  const ctx = await guard(request, true)
  if (ctx instanceof Response) return ctx
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError("send JSON", 400, "invalid-input")
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return apiError("send { signals: [...] }", 400, "invalid-input")
  const now = Date.now()
  const signals = parsed.data.signals.filter((s) => s.at <= now + FUTURE_SLACK_MS) as Signal[]
  try {
    await ctx.repo.add(ctx.viewer.id, signals)
    return apiOk({ stored: signals.length })
  } catch (error) {
    log.error("taste.write_failed", { error: errorMessage(error) })
    return apiError("couldn't save your taste", 500, "server-error")
  }
}

/** DELETE /api/taste → "reset taste": forgets every signal on the account. */
export async function DELETE(request: Request): Promise<Response> {
  const ctx = await guard(request, true)
  if (ctx instanceof Response) return ctx
  try {
    await ctx.repo.reset(ctx.viewer.id)
    return apiOk({ reset: true })
  } catch (error) {
    log.error("taste.reset_failed", { error: errorMessage(error) })
    return apiError("couldn't reset your taste", 500, "server-error")
  }
}
