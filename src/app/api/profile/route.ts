import { z } from "zod"
import { getDb } from "@/db"
import { claimHandle } from "@/db/fit-repository"
import { createSocialRepository } from "@/db/social-repository"
import { inviterFromCookie } from "@/lib/social/founding"
import { handleSchema } from "@/lib/fits/schema"
import { getLimiter } from "@/lib/rate-limit"
import { apiError, apiOk } from "@/lib/request"
import { getViewer } from "@/lib/supabase/server"
import { sameOrigin } from "@/lib/fits/route-helpers"

const bodySchema = z.object({ handle: handleSchema })

/** POST /api/profile { handle } → claims the signed-in user's public handle. */
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return apiError("cross-site request refused", 403, "forbidden")
  const viewer = await getViewer()
  if (!viewer) return apiError("sign in first", 401, "unauthenticated")
  const db = getDb()
  if (!db) return apiError("profiles aren't available", 503, "unavailable")
  const limit = await getLimiter("handle", 10, "1 h", { durable: true }).limit(viewer.id)
  if (!limit.success) return apiError("slow down a little", 429, "rate-limited")

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError("send JSON", 400, "invalid-input")
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "invalid handle", 400, "invalid-input")
  }
  const claimed = await claimHandle(db, viewer.id, parsed.data.handle)
  // Arrived through a friend's invite link: a founding-50 badge while spots last.
  if (claimed && inviterFromCookie(request.headers.get("cookie"))) {
    await createSocialRepository(db)
      .claimFounding(viewer.id)
      .catch(() => null)
  }
  return claimed
    ? apiOk({ handle: parsed.data.handle })
    : apiError("that handle is taken", 409, "taken")
}
