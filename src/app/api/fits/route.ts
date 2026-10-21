import { FitImageError, MAX_UPLOAD_BYTES } from "@/lib/fits/image"
import { MAX_UPLOAD_LABEL } from "@/lib/fits/limits"
import { fitInputSchema } from "@/lib/fits/schema"
import { FitPostError, postFit } from "@/lib/fits/server"
import { errorMessage, log } from "@/lib/log"
import { getLimiter } from "@/lib/rate-limit"
import { apiError, apiOk } from "@/lib/request"
import { getViewer } from "@/lib/supabase/server"
import { sameOrigin } from "@/lib/fits/route-helpers"

/** Posts per person per day: plenty for real fits, a wall for spam. */
const POSTS_PER_DAY = 6

/**
 * POST /api/fits (multipart: photo + data JSON) → posts a fit. The photo is
 * re-encoded server-side (EXIF and GPS stripped) before it's stored.
 */
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return apiError("cross-site request refused", 403, "forbidden")
  const viewer = await getViewer()
  if (!viewer) return apiError("sign in to post", 401, "unauthenticated")
  // Refuse oversized bodies before reading them (the photo cap plus room for the form).
  const declared = Number(request.headers.get("content-length") ?? NaN)
  if (!Number.isFinite(declared) || declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    return apiError(`Photos can be up to ${MAX_UPLOAD_LABEL}.`, 413, "too-large")
  }
  const limit = await getLimiter("fit-post", POSTS_PER_DAY, "1 d", { durable: true }).limit(
    viewer.id,
  )
  if (!limit.success) return apiError("That's today's posts. Back tomorrow.", 429, "rate-limited")

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return apiError("send the photo as form data", 400, "invalid-input")
  }
  const photo = form.get("photo")
  if (!(photo instanceof File) || photo.size === 0)
    return apiError("add a photo", 400, "invalid-input")
  if (photo.size > MAX_UPLOAD_BYTES)
    return apiError(`Photos can be up to ${MAX_UPLOAD_LABEL}.`, 413, "too-large")

  let data: unknown
  try {
    data = JSON.parse(String(form.get("data") ?? "{}"))
  } catch {
    return apiError("bad post details", 400, "invalid-input")
  }
  const input = fitInputSchema.safeParse(data)
  if (!input.success) {
    return apiError(input.error.issues[0]?.message ?? "bad post details", 400, "invalid-input")
  }

  try {
    const id = await postFit(viewer, new Uint8Array(await photo.arrayBuffer()), input.data)
    return apiOk({ id }, 201)
  } catch (error) {
    if (error instanceof FitImageError || error instanceof FitPostError) {
      return apiError(error.message, 400, "invalid-input")
    }
    log.error("api.fits.post_failed", { error: errorMessage(error) })
    return apiError("Posting failed. Try again.", 500, "internal")
  }
}
