import { z } from "zod"
import { MAX_GRAIL_SEARCHES } from "@/db/alerts-repository"
import { alertsContext, readJson } from "@/lib/alerts/route-guard"
import { TAXONOMY } from "@/lib/niches/catalog"
import { apiError, apiOk } from "@/lib/request"

const createSchema = z.object({
  brandSlug: z.string().regex(/^[a-z0-9-]{1,64}$/),
  item: z.string().trim().min(2).max(60),
  maxPrice: z.number().int().min(10).max(50_000),
  size: z.string().trim().min(1).max(12).nullable(),
})

/** GET /api/grails → the person's hunts. */
export async function GET(request: Request): Promise<Response> {
  const ctx = await alertsContext(request, { write: false })
  if (ctx instanceof Response) return ctx
  return apiOk({ grails: await ctx.repo.grailsOf(ctx.viewer.id) })
}

/** POST /api/grails { brandSlug, item, maxPrice, size } → a new hunt (verified brands only). */
export async function POST(request: Request): Promise<Response> {
  const ctx = await alertsContext(request, { write: true })
  if (ctx instanceof Response) return ctx
  const parsed = createSchema.safeParse(await readJson(request))
  if (!parsed.success) return apiError("brand, item and a max price, please", 400, "invalid-input")
  const brand = TAXONOMY.brand(parsed.data.brandSlug)
  if (!brand) return apiError("unknown brand", 400, "invalid-input")
  const grail = await ctx.repo.addGrail(ctx.viewer.id, {
    brandSlug: brand.slug,
    brand: brand.name,
    item: parsed.data.item,
    maxPrice: parsed.data.maxPrice,
    size: parsed.data.size,
  })
  return grail
    ? apiOk({ grail })
    : apiError(`you can hunt up to ${MAX_GRAIL_SEARCHES} grails at once`, 409, "limit")
}

/** DELETE /api/grails?id=uuid → stop hunting. */
export async function DELETE(request: Request): Promise<Response> {
  const ctx = await alertsContext(request, { write: true })
  if (ctx instanceof Response) return ctx
  const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get("id"))
  if (!id.success) return apiError("pass ?id=", 400, "invalid-input")
  await ctx.repo.deleteGrail(ctx.viewer.id, id.data)
  return apiOk({ deleted: true })
}
