import { z } from "zod"
import { getDb } from "@/db"
import { deleteFit, getFit } from "@/db/fit-repository"
import { FITS_BUCKET, QUARANTINE_BUCKET, toViews } from "@/lib/fits/server"
import { fitAction } from "@/lib/fits/route-helpers"
import { canSeeFit } from "@/lib/fits/visibility"
import { log } from "@/lib/log"
import { apiError, apiOk } from "@/lib/request"
import { getStorageAdmin } from "@/lib/supabase/admin"
import { getViewer } from "@/lib/supabase/server"

const LIMIT = { name: "fit-delete", max: 30, window: "1 h" } as const

/** DELETE /api/fits/:id → the author removes their fit (row and photo). */
export async function DELETE(request: Request, ctx: RouteContext<"/api/fits/[id]">) {
  const guard = await fitAction(request, ctx.params, LIMIT)
  if ("error" in guard) return guard.error
  const path = await deleteFit(guard.db, guard.id, guard.viewer.id)
  if (!path) return apiError("not your fit", 404, "invalid-input")
  // A hidden fit's photo sits in quarantine: remove it from both buckets.
  const storage = getStorageAdmin()?.storage
  for (const bucket of [FITS_BUCKET, QUARANTINE_BUCKET]) {
    const removed = await storage?.from(bucket).remove([path])
    if (removed?.error) {
      log.warn("fits.storage_delete_failed", { bucket, path, error: removed.error.message })
    }
  }
  return apiOk({ deleted: true })
}

/** GET /api/fits/:id → one fit this viewer may see (or their own, even if hidden). */
export async function GET(_request: Request, ctx: RouteContext<"/api/fits/[id]">) {
  const { id } = await ctx.params
  const db = getDb()
  if (!db || !z.string().uuid().safeParse(id).success)
    return apiError("no such fit", 404, "invalid-input")
  const [row, viewer] = await Promise.all([getFit(db, id), getViewer()])
  if (!row || !(await canSeeFit(db, row, viewer?.id ?? null))) {
    return apiError("no such fit", 404, "invalid-input")
  }
  const [view] = await toViews([row], viewer)
  return apiOk(view)
}
