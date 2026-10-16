import { z } from "zod"
import { alertsContext, readJson } from "@/lib/alerts/route-guard"
import { apiError, apiOk } from "@/lib/request"

const minute = z
  .number()
  .int()
  .min(0)
  .max(24 * 60 - 1)
const patchSchema = z
  .object({
    drops: z.boolean(),
    grails: z.boolean(),
    niches: z.boolean(),
    friends: z.boolean(),
    quietStart: minute,
    quietEnd: minute,
    timeZone: z
      .string()
      .max(64)
      .refine((zone) => {
        try {
          new Intl.DateTimeFormat("en-US", { timeZone: zone })
          return true
        } catch {
          return false
        }
      }, "unknown time zone"),
  })
  .partial()

/** GET /api/alerts/prefs → per-type toggles and quiet hours. */
export async function GET(request: Request): Promise<Response> {
  const ctx = await alertsContext(request, { write: false })
  if (ctx instanceof Response) return ctx
  const p = await ctx.repo.prefs(ctx.viewer.id)
  return apiOk({
    drops: p.drops,
    grails: p.grails,
    niches: p.niches,
    friends: p.friends,
    quietStart: p.quietStart,
    quietEnd: p.quietEnd,
    timeZone: p.timeZone,
  })
}

/** PUT /api/alerts/prefs { …partial } → saves what changed. */
export async function PUT(request: Request): Promise<Response> {
  const ctx = await alertsContext(request, { write: true })
  if (ctx instanceof Response) return ctx
  const parsed = patchSchema.safeParse(await readJson(request))
  if (!parsed.success) return apiError("invalid alert settings", 400, "invalid-input")
  await ctx.repo.updatePrefs(ctx.viewer.id, parsed.data)
  return apiOk({ saved: true })
}
