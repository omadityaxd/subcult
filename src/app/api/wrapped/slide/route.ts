import { errorMessage, log } from "@/lib/log"
import { findSeedProfile } from "@/lib/niches/catalog"
import { apiError } from "@/lib/request"
import { slideCopy } from "@/lib/wrapped/copy"
import { renderSlideImage } from "@/lib/wrapped/slide-image"
import { slideNiche, slideSchema } from "@/lib/wrapped/slides"
import { ipLimited } from "@/lib/rate-limit"

const NEUTRAL = ["#0a0a0a", "#1a1a1a", "#444444", "#bbbbbb", "#f2f2f2"]
const MAX_BODY_BYTES = 8_000

/**
 * POST /api/wrapped/slide { slide, niche? } → 1080×1920 PNG of one Wrapped
 * slide. Stats come from the device (nothing is stored server-side); the
 * schema bounds every field and only allows Spotify/Apple artwork URLs.
 */
export async function POST(request: Request): Promise<Response> {
  const limited = await ipLimited(request, "wrapped-slide", 20, "10 m")
  if (limited) return limited
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) return apiError("slide too large", 413, "invalid-input")
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return apiError("send JSON", 400, "invalid-input")
  }
  const raw = body as { slide?: unknown; niche?: unknown }
  const parsed = slideSchema.safeParse(raw?.slide)
  if (!parsed.success) return apiError("invalid slide", 400, "invalid-input")

  const fallback = typeof raw.niche === "string" ? raw.niche : null
  const nicheSlug = slideNiche(parsed.data, fallback)
  const palette = (nicheSlug && findSeedProfile(nicheSlug)?.palette) || NEUTRAL
  const nameOf = (slug: string) => findSeedProfile(slug)?.name ?? slug
  try {
    const image = await renderSlideImage(slideCopy(parsed.data, nameOf), palette)
    return new Response(image.body, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="subcult-wrapped-${parsed.data.kind}.png"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    log.error("wrapped.slide_failed", { error: errorMessage(error) })
    return apiError("couldn't render that slide", 500, "failed")
  }
}
