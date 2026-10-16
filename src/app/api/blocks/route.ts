import { apiError, apiOk } from "@/lib/request"
import { handleBody, readJson, socialContext } from "@/lib/social/route-guard"

/** POST /api/blocks { handle } → block: unfollows both ways, hides each from the other. */
export async function POST(request: Request): Promise<Response> {
  const ctx = await socialContext(request)
  if (ctx instanceof Response) return ctx
  const parsed = handleBody.safeParse(await readJson(request))
  if (!parsed.success) return apiError("send { handle }", 400, "invalid-input")
  const target = await ctx.social.byHandle(parsed.data.handle)
  if (!target) return apiError("no one has that handle", 404, "not-found")
  await ctx.social.block(ctx.viewer.id, target.id)
  return apiOk({ blocked: true })
}

/** DELETE /api/blocks { handle } → unblock. */
export async function DELETE(request: Request): Promise<Response> {
  const ctx = await socialContext(request)
  if (ctx instanceof Response) return ctx
  const parsed = handleBody.safeParse(await readJson(request))
  if (!parsed.success) return apiError("send { handle }", 400, "invalid-input")
  const target = await ctx.social.byHandle(parsed.data.handle)
  if (target) await ctx.social.unblock(ctx.viewer.id, target.id)
  return apiOk({ blocked: false })
}
