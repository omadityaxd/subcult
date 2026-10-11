import { setLike } from "@/db/fit-repository"
import { fitAction } from "@/lib/fits/route-helpers"
import { apiOk } from "@/lib/request"

const LIMIT = { name: "fit-like", max: 120, window: "1 h" } as const

async function handle(request: Request, ctx: RouteContext<"/api/fits/[id]/like">, liked: boolean) {
  const guard = await fitAction(request, ctx.params, LIMIT)
  if ("error" in guard) return guard.error
  const likeCount = await setLike(guard.db, guard.id, guard.viewer.id, liked)
  return apiOk({ liked, likeCount })
}

/** POST likes, DELETE unlikes. */
export function POST(request: Request, ctx: RouteContext<"/api/fits/[id]/like">) {
  return handle(request, ctx, true)
}

export function DELETE(request: Request, ctx: RouteContext<"/api/fits/[id]/like">) {
  return handle(request, ctx, false)
}
