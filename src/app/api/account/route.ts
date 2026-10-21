import { z } from "zod"
import { getDb } from "@/db"
import { deleteAccountData, exportAccount } from "@/db/account-repository"
import { getProfile } from "@/db/fit-repository"
import { sameOrigin } from "@/lib/fits/route-helpers"
import { FITS_BUCKET, QUARANTINE_BUCKET } from "@/lib/fits/server"
import { errorMessage, log } from "@/lib/log"
import { getLimiter } from "@/lib/rate-limit"
import { apiError, apiOk } from "@/lib/request"
import { getStorageAdmin } from "@/lib/supabase/admin"
import { createSupabaseServer, getViewer } from "@/lib/supabase/server"

const deleteSchema = z.object({ confirm: z.string().trim().min(1).max(40) })

/** GET /api/account → everything we hold about you, as a JSON download. */
export async function GET(): Promise<Response> {
  const viewer = await getViewer()
  if (!viewer) return apiError("sign in first", 401, "unauthenticated")
  const limit = await getLimiter("account-export", 5, "1 h", { durable: true }).limit(viewer.id)
  if (!limit.success) return apiError("slow down a little", 429, "rate-limited")
  const db = getDb()
  if (!db) return apiError("not available right now", 503, "unavailable")
  const data = await exportAccount(db, viewer.id)
  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      account: { id: viewer.id, email: viewer.email },
      ...data,
    },
    null,
    2,
  )
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="subcult-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  })
}

/**
 * DELETE /api/account { confirm: "<your handle>" } → deletes the account and
 * everything tied to it: taste data, fits and their photos, likes, saves,
 * follows, blocks, votes, alerts, push subscriptions, and the sign-in
 * itself. Nothing is deleted unless all of it can be.
 */
export async function DELETE(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return apiError("cross-site request refused", 403, "forbidden")
  const viewer = await getViewer()
  if (!viewer) return apiError("sign in first", 401, "unauthenticated")
  const limit = await getLimiter("account-delete", 3, "1 h", { durable: true }).limit(viewer.id)
  if (!limit.success) return apiError("slow down a little", 429, "rate-limited")
  const db = getDb()
  const admin = getStorageAdmin()
  // Without the admin client the sign-in itself couldn't be removed: refuse up front.
  if (!db || !admin)
    return apiError("Account deletion isn't available right now.", 503, "unavailable")

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null))
  const profile = await getProfile(db, viewer.id)
  const expected = profile?.handle ?? "delete"
  if (!parsed.success || parsed.data.confirm.replace(/^@/, "").toLowerCase() !== expected) {
    return apiError(`Type ${profile ? `@${expected}` : "delete"} to confirm.`, 400, "invalid-input")
  }

  try {
    const photos = await deleteAccountData(db, viewer.id)
    if (photos.length > 0) {
      await admin.storage.from(FITS_BUCKET).remove(photos)
      await admin.storage.from(QUARANTINE_BUCKET).remove(photos)
    }
    const { error } = await admin.auth.admin.deleteUser(viewer.id)
    if (error) throw error
  } catch (error) {
    log.error("account.delete_failed", { error: errorMessage(error) })
    return apiError("Something went wrong deleting your account. Try again.", 500, "failed")
  }
  await (await createSupabaseServer())?.auth.signOut().catch(() => undefined)
  log.info("account.deleted", {})
  return apiOk({ deleted: true })
}
