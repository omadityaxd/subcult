import { setSave } from "@/db/fit-repository"
import { fitAction } from "@/lib/fits/route-helpers"
import { apiOk } from "@/lib/request"

const LIMIT = { name: "fit-save", max: 120, window: "1 h" } as const

async function handle(request: Request, ctx: RouteContext<"/api/fits/[id]/save">, saved: boolean) {
  const guard = await fitAction(request, ctx.params, LIMIT)
  if ("error" in guard) return guard.error
  await setSave(guard.db, guard.id, guard.viewer.id, saved)
  return apiOk({ saved })
}

/** POST saves to the viewer's profile, DELETE removes it. */
export function POST(request: Request, ctx: RouteContext<"/api/fits/[id]/save">) {
  return handle(request, ctx, true)
}

export function DELETE(request: Request, ctx: RouteContext<"/api/fits/[id]/save">) {
  return handle(request, ctx, false)
}
