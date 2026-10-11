import { z } from "zod"
import { errorMessage, log } from "@/lib/log"
import type { Preview } from "@/lib/music/itunes"
import { cachedTrackPreview } from "@/lib/music/preview-server"
import { getPreviewLimiter } from "@/lib/rate-limit"
import { apiError, apiOk, clientIp } from "@/lib/request"

const MAX_PREVIEW_LOOKUPS = 20

const bodySchema = z.object({
  tracks: z
    .array(z.object({ title: z.string().min(1).max(200), artist: z.string().min(1).max(200) }))
    .min(1)
    .max(MAX_PREVIEW_LOOKUPS),
})

export interface PreviewsResponse {
  /** Same order as the request; null where no exact 30s preview exists. */
  previews: (Preview | null)[]
}

/**
 * POST /api/music/previews { tracks: [{ title, artist }] } → exact iTunes
 * previews for Spotify tracks, so any song in the app plays in our player.
 * Matches (and misses) are cached for a week.
 */
export async function POST(request: Request): Promise<Response> {
  const limit = await getPreviewLimiter().limit(clientIp(request.headers))
  if (!limit.success) return apiError("slow down a little", 429, "rate-limited")

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError("send JSON", 400, "invalid-input")
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return apiError("pass { tracks: [{ title, artist }] }", 400, "invalid-input")

  const previews = await Promise.all(
    parsed.data.tracks.map(({ title, artist }) =>
      cachedTrackPreview(artist, title).catch((error: unknown) => {
        log.warn("api.music.preview_failed", { title, artist, error: errorMessage(error) })
        return null
      }),
    ),
  )
  return apiOk<PreviewsResponse>({ previews })
}
