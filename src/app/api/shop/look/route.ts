import { z } from "zod"
import { errorMessage, log } from "@/lib/log"
import { TAXONOMY } from "@/lib/niches/catalog"
import { getLimiter } from "@/lib/rate-limit"
import { apiError, apiOk, clientIp } from "@/lib/request"
import type { Listing } from "@/lib/shop/ebay"
import { brandListings } from "@/lib/shop/look-server"
import { ebayCredentials } from "@/lib/shop/server"

const PER_BRAND = 6

const querySchema = z.object({
  brands: z
    .string()
    .regex(/^[a-z0-9-]{1,64}(,[a-z0-9-]{1,64}){0,3}$/)
    .transform((v) => v.split(",")),
})

export interface LookListing extends Listing {
  brandSlug: string
  brand: string
}

/**
 * GET /api/shop/look?brands=rick-owens,chrome-hearts → live eBay listings for
 * a fit's tagged brands ("shop the look"). Verified brands only; cached 6h.
 */
export async function GET(request: Request): Promise<Response> {
  const limit = await getLimiter("shop-look", 30, "10 m").limit(clientIp(request.headers))
  if (!limit.success) return apiError("slow down a little", 429, "rate-limited")
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return apiError("pass ?brands=slug,slug", 400, "invalid-input")
  if (!ebayCredentials()) return apiOk({ listings: [] as LookListing[], available: false })
  const brands = parsed.data.brands.flatMap((slug) => TAXONOMY.brand(slug) ?? [])
  const lists = await Promise.all(
    brands.map(async (brand) => {
      try {
        return ((await brandListings(brand)) ?? [])
          .slice(0, PER_BRAND)
          .map((listing): LookListing => ({ ...listing, brandSlug: brand.slug, brand: brand.name }))
      } catch (error) {
        log.warn("shop.look_failed", { brand: brand.slug, error: errorMessage(error) })
        return []
      }
    }),
  )
  return apiOk({ listings: lists.flat(), available: true })
}
