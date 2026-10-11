import { reportFit } from "@/db/fit-repository"
import { AUTO_HIDE_REPORTS, reportSchema } from "@/lib/fits/schema"
import { fitAction } from "@/lib/fits/route-helpers"
import { quarantinePhoto } from "@/lib/fits/server"
import { log } from "@/lib/log"
import { apiError, apiOk } from "@/lib/request"

const LIMIT = { name: "fit-report", max: 10, window: "1 d" } as const

/** POST /api/fits/:id/report { reason } → one report per person; enough reports hide it. */
export async function POST(request: Request, ctx: RouteContext<"/api/fits/[id]/report">) {
  const guard = await fitAction(request, ctx.params, LIMIT)
  if ("error" in guard) return guard.error
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError("send JSON", 400, "invalid-input")
  }
  const parsed = reportSchema.safeParse(body)
  if (!parsed.success) return apiError("pick a reason", 400, "invalid-input")
  const result = await reportFit(
    guard.db,
    guard.id,
    guard.viewer.id,
    parsed.data.reason,
    AUTO_HIDE_REPORTS,
  )
  if (result.hidden && result.imagePath) {
    log.info("fits.auto_hidden", { fitId: guard.id })
    await quarantinePhoto(result.imagePath, true)
  }
  return apiOk({ reported: true })
}
