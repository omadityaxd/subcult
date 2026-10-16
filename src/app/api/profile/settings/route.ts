import { z } from "zod"
import { PROFILE_VISIBILITY } from "@/db/schema"
import { apiError, apiOk } from "@/lib/request"
import { readJson, socialContext } from "@/lib/social/route-guard"

const patchSchema = z
  .object({ visibility: z.enum(PROFILE_VISIBILITY), shareListening: z.boolean() })
  .partial()

/** GET /api/profile/settings → privacy, listening, your lists and your invite handle. */
export async function GET(request: Request): Promise<Response> {
  const ctx = await socialContext(request)
  if (ctx instanceof Response) return ctx
  const [settings, following, followers, blocked] = await Promise.all([
    ctx.social.settings(ctx.viewer.id),
    ctx.social.following(ctx.viewer.id),
    ctx.social.followers(ctx.viewer.id),
    ctx.social.blocked(ctx.viewer.id),
  ])
  const handles = (people: { handle: string }[]) => people.map((p) => p.handle)
  return apiOk({
    handle: ctx.handle,
    visibility: settings.visibility,
    shareListening: settings.shareListening,
    following: handles(following),
    followers: handles(followers),
    blocked: handles(blocked),
  })
}

/** PUT /api/profile/settings { visibility?, shareListening? } */
export async function PUT(request: Request): Promise<Response> {
  const ctx = await socialContext(request)
  if (ctx instanceof Response) return ctx
  const parsed = patchSchema.safeParse(await readJson(request))
  if (!parsed.success) return apiError("invalid settings", 400, "invalid-input")
  // Turning listening off also forgets the last track.
  const patch =
    parsed.data.shareListening === false
      ? { ...parsed.data, listening: null, listeningAt: null }
      : parsed.data
  await ctx.social.updateSettings(ctx.viewer.id, patch)
  return apiOk({ saved: true })
}
