import { createAlertsRepository } from "@/db/alerts-repository"
import { errorMessage, log } from "@/lib/log"
import { apiError, apiOk } from "@/lib/request"
import { matchPercent } from "@/lib/social/match"
import { handleBody, readJson, socialContext } from "@/lib/social/route-guard"
import { tasteVectorOf } from "@/lib/social/server"

/** POST /api/follows { handle } → follow them (and tell them, with your vibe match). */
export async function POST(request: Request): Promise<Response> {
  const ctx = await socialContext(request)
  if (ctx instanceof Response) return ctx
  const parsed = handleBody.safeParse(await readJson(request))
  if (!parsed.success) return apiError("send { handle }", 400, "invalid-input")
  const target = await ctx.social.byHandle(parsed.data.handle)
  if (!target) return apiError("no one has that handle", 404, "not-found")
  const added = await ctx.social.follow(ctx.viewer.id, target.id)
  if (!added) {
    const relation = await ctx.social.relation(ctx.viewer.id, target.id)
    return relation.blocked
      ? apiError("can't follow", 403, "forbidden")
      : apiOk({ following: true })
  }
  try {
    const alerts = createAlertsRepository(ctx.db)
    if ((await alerts.prefs(target.id)).friends) {
      const percent = matchPercent(
        await tasteVectorOf(target.id),
        await tasteVectorOf(ctx.viewer.id),
      )
      await alerts.notify(target.id, {
        type: "friend",
        title: `@${ctx.handle} followed you`,
        body: percent > 0 ? `${percent}% vibe match` : null,
        url: `/u/${ctx.handle}`,
        dedupeKey: `follow:${ctx.viewer.id}`,
      })
    }
  } catch (error) {
    log.warn("follows.notify_failed", { error: errorMessage(error) })
  }
  return apiOk({ following: true })
}

/** DELETE /api/follows { handle } → unfollow. */
export async function DELETE(request: Request): Promise<Response> {
  const ctx = await socialContext(request)
  if (ctx instanceof Response) return ctx
  const parsed = handleBody.safeParse(await readJson(request))
  if (!parsed.success) return apiError("send { handle }", 400, "invalid-input")
  const target = await ctx.social.byHandle(parsed.data.handle)
  if (target) await ctx.social.unfollow(ctx.viewer.id, target.id)
  return apiOk({ following: false })
}
