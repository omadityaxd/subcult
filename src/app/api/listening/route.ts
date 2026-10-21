import { z } from "zod"
import { apiError, apiOk } from "@/lib/request"
import { readJson, socialContext } from "@/lib/social/route-guard"
import { artworkUrlSchema } from "@/lib/wrapped/slides"

const bodySchema = z.object({
  title: z.string().trim().min(1).max(120),
  artist: z.string().trim().min(1).max(120),
  // Followers' browsers load this image: only Spotify's and Apple's CDNs, else no artwork.
  artworkUrl: z
    .string()
    .max(500)
    .nullable()
    .transform((url) => (url && artworkUrlSchema.safeParse(url).success ? url : null)),
})

/** POST /api/listening { title, artist, artworkUrl } → "currently playing", only if opted in. */
export async function POST(request: Request): Promise<Response> {
  const ctx = await socialContext(request)
  if (ctx instanceof Response) return ctx
  const parsed = bodySchema.safeParse(await readJson(request))
  if (!parsed.success) return apiError("invalid track", 400, "invalid-input")
  const settings = await ctx.social.settings(ctx.viewer.id)
  if (!settings.shareListening) return apiOk({ shared: false })
  await ctx.social.updateSettings(ctx.viewer.id, {
    listening: parsed.data,
    listeningAt: new Date(),
  })
  return apiOk({ shared: true })
}
