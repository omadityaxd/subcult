import { errorMessage, log } from "@/lib/log"
import { getPreviewLimiter } from "@/lib/rate-limit"
import { apiError, apiOk, clientIp } from "@/lib/request"
import { getListingDetail } from "@/lib/shop/server"

/** eBay RESTful item ids look like "v1|123456789012|0". */
const ITEM_ID = /^v1\|\d{6,20}\|\d{1,20}$/

/** GET /api/shop/listings/:id → one live eBay listing for the in-app product sheet. */
export async function GET(request: Request, ctx: RouteContext<"/api/shop/listings/[id]">) {
  const { id } = await ctx.params
  const itemId = decodeURIComponent(id)
  if (!ITEM_ID.test(itemId)) return apiError("not an eBay item id", 400, "invalid-input")
  const limit = await getPreviewLimiter().limit(clientIp(request.headers))
  if (!limit.success) return apiError("slow down a little", 429, "rate-limited")
  try {
    const listing = await getListingDetail(itemId)
    return listing ? apiOk(listing) : apiError("listing unavailable", 404, "unavailable")
  } catch (error) {
    log.warn("api.shop.listing_failed", { itemId, error: errorMessage(error) })
    return apiError("eBay didn't answer", 502, "upstream")
  }
}
