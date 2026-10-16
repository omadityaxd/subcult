import { z } from "zod"
import { errorMessage, log } from "@/lib/log"
import { getLimiter } from "@/lib/rate-limit"
import { apiError, apiOk, clientIp } from "@/lib/request"
import { type EntityRef, isEntityRef } from "@/lib/taste/entities"
import { buildToday } from "@/lib/today/server"
import { getViewer } from "@/lib/supabase/server"

const bodySchema = z.object({
  entities: z
    .array(
      z.object({
        ref: z.string().refine(isEntityRef),
        score: z.number().finite().min(-1000).max(1000),
      }),
    )
    .max(40),
  brands: z.array(z.string().regex(/^[a-z0-9-]{1,64}$/)).max(40),
  lastVisit: z.number().int().positive().nullable(),
  timeZone: z.string().max(64),
})

/**
 * POST /api/today { entities, brands, lastVisit, timeZone } → this person's
 * edition. Taste lives on the device (and the account), so the client sends
 * its strongest entities; nothing here is stored.
 */
export async function POST(request: Request): Promise<Response> {
  const limit = await getLimiter("today", 60, "10 m").limit(clientIp(request.headers))
  if (!limit.success) return apiError("slow down a little", 429, "rate-limited")
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError("send JSON", 400, "invalid-input")
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return apiError("invalid Today request", 400, "invalid-input")
  try {
    const viewer = await getViewer().catch(() => null)
    const edition = await buildToday({
      ...parsed.data,
      viewerId: viewer?.id ?? null,
      entities: parsed.data.entities.map((e) => ({ ref: e.ref as EntityRef, score: e.score })),
    })
    return apiOk(edition)
  } catch (error) {
    log.error("today.failed", { error: errorMessage(error) })
    return apiError("couldn't build Today", 500, "failed")
  }
}
