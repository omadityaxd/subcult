import { z } from "zod"
import { cached } from "@/lib/feed/cache"
import { errorMessage, log } from "@/lib/log"
import { getCacheStore } from "@/lib/music/server"
import { TAXONOMY } from "@/lib/niches/catalog"
import { getLimiter } from "@/lib/rate-limit"
import { apiError, apiOk, clientIp } from "@/lib/request"
import { type Listing, searchListings } from "@/lib/shop/ebay"
import { ebayCredentials } from "@/lib/shop/server"

const PER_BRAND = 6
const POLICY = { freshSeconds: 6 * 3600, staleSeconds: 48 * 3600 }

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
  const credentials = ebayCredentials()
  if (!credentials) return apiOk({ listings: [] as LookListing[], available: false })
  const brands = parsed.data.brands.flatMap((slug) => TAXONOMY.brand(slug) ?? [])
  const lists = await Promise.all(
    brands.map(async (brand) => {
      try {
        const { value } = await cached(
          getCacheStore(),
          `subcult:shop-look:v1:${brand.slug}`,
          POLICY,
          () => searchListings(brand.name, credentials, { limit: PER_BRAND * 2 }),
        )
        return value
          .filter((listing) => listing.imageUrl)
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
