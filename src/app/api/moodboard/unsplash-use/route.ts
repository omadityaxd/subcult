import { z } from "zod"
import { env } from "@/lib/env"
import { errorMessage, log } from "@/lib/log"
import { getPreviewLimiter } from "@/lib/rate-limit"
import { apiError, apiOk, clientIp } from "@/lib/request"

/** https://api.unsplash.com/photos/<id>/download with only Unsplash's ixid tracking param. */
function isDownloadLocation(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      url.host === "api.unsplash.com" &&
      /^\/photos\/[\w-]+\/download$/.test(url.pathname) &&
      [...url.searchParams.keys()].every((key) => key === "ixid")
    )
  } catch {
    return false
  }
}

const bodySchema = z.object({
  // Only Unsplash's own download-tracking endpoints, never an arbitrary URL.
  downloadLocation: z
    .string()
    .url()
    .refine(isDownloadLocation, "not an Unsplash download URL"),
})

/**
 * POST /api/moodboard/unsplash-use { downloadLocation } → tells Unsplash a
 * photo was used (saved to a board), as their API guidelines require. The
 * key stays on the server.
 */
export async function POST(request: Request): Promise<Response> {
  if (!env.UNSPLASH_ACCESS_KEY) return apiOk({ tracked: false })
  const limit = await getPreviewLimiter().limit(clientIp(request.headers))
  if (!limit.success) return apiError("slow down a little", 429, "rate-limited")
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError("send JSON", 400, "invalid-input")
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return apiError("pass { downloadLocation }", 400, "invalid-input")
  try {
    const response = await fetch(parsed.data.downloadLocation, {
      headers: { Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}` },
      signal: AbortSignal.timeout(5_000),
    })
    return apiOk({ tracked: response.ok })
  } catch (error) {
    log.warn("api.moodboard.unsplash_use_failed", { error: errorMessage(error) })
    return apiOk({ tracked: false })
  }
}
