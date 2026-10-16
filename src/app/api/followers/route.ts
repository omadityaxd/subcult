import { apiError, apiOk } from "@/lib/request"
import { handleBody, readJson, socialContext } from "@/lib/social/route-guard"

/** DELETE /api/followers { handle } → remove someone who follows you. */
export async function DELETE(request: Request): Promise<Response> {
  const ctx = await socialContext(request)
  if (ctx instanceof Response) return ctx
  const parsed = handleBody.safeParse(await readJson(request))
  if (!parsed.success) return apiError("send { handle }", 400, "invalid-input")
  const follower = await ctx.social.byHandle(parsed.data.handle)
  if (follower) await ctx.social.unfollow(follower.id, ctx.viewer.id)
  return apiOk({ removed: true })
}
