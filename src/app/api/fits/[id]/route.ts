import { z } from "zod"
import { getDb } from "@/db"
import { deleteFit, getFit } from "@/db/fit-repository"
import { FITS_BUCKET, toViews } from "@/lib/fits/server"
import { fitAction } from "@/lib/fits/route-helpers"
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
  const removed = await getStorageAdmin()?.storage.from(FITS_BUCKET).remove([path])
  if (removed?.error) log.warn("fits.storage_delete_failed", { path, error: removed.error.message })
  return apiOk({ deleted: true })
}

/** GET /api/fits/:id → one visible fit (or the viewer's own, even if hidden). */
export async function GET(_request: Request, ctx: RouteContext<"/api/fits/[id]">) {
  const { id } = await ctx.params
  const db = getDb()
  if (!db || !z.string().uuid().safeParse(id).success)
    return apiError("no such fit", 404, "invalid-input")
  const [row, viewer] = await Promise.all([getFit(db, id), getViewer()])
  if (!row || (row.status !== "visible" && row.userId !== viewer?.id)) {
    return apiError("no such fit", 404, "invalid-input")
  }
  const [view] = await toViews([row], viewer)
  return apiOk(view)
}
