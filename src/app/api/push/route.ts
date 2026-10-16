import { z } from "zod"
import { isPushEndpoint } from "@/lib/alerts/policy"
import { alertsContext, readJson } from "@/lib/alerts/route-guard"
import { errorMessage, log } from "@/lib/log"
import { apiError, apiOk } from "@/lib/request"

const endpoint = z.string().url().max(1000).refine(isPushEndpoint, "not a known push service")
const subscribeSchema = z.object({
  endpoint,
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
})

/** POST /api/push { endpoint, keys } → this device gets the account's alerts. */
export async function POST(request: Request): Promise<Response> {
  const ctx = await alertsContext(request, { write: true })
  if (ctx instanceof Response) return ctx
  const parsed = subscribeSchema.safeParse(await readJson(request))
  if (!parsed.success) return apiError("send a PushSubscription", 400, "invalid-input")
  try {
    await ctx.repo.savePushSubscription(ctx.viewer.id, {
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    })
    return apiOk({ subscribed: true })
  } catch (error) {
    log.error("push.subscribe_failed", { error: errorMessage(error) })
    return apiError("couldn't turn on push", 500, "failed")
  }
}

/** DELETE /api/push { endpoint } → stop pushing to this device. */
export async function DELETE(request: Request): Promise<Response> {
  const ctx = await alertsContext(request, { write: true })
  if (ctx instanceof Response) return ctx
  const parsed = z.object({ endpoint }).safeParse(await readJson(request))
  if (!parsed.success) return apiError("send { endpoint }", 400, "invalid-input")
  await ctx.repo.deletePushSubscription(parsed.data.endpoint, ctx.viewer.id)
  return apiOk({ subscribed: false })
}
