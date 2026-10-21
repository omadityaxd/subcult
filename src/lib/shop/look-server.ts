import "server-only"
import { cached } from "@/lib/feed/cache"
import { getCacheStore } from "@/lib/music/server"
import { type Listing, searchListings } from "./ebay"
import { ebayCredentials } from "./server"

const POLICY = { freshSeconds: 6 * 3600, staleSeconds: 48 * 3600 }
const FETCHED = 12

/**
 * Live eBay listings for one verified brand (with images), cached 6h and
 * shared by "shop the look" and search. Null when eBay isn't switched on.
 */
export async function brandListings(brand: {
  slug: string
  name: string
}): Promise<Listing[] | null> {
  const credentials = ebayCredentials()
  if (!credentials) return null
  const { value } = await cached(
    getCacheStore(),
    `subcult:shop-look:v1:${brand.slug}`,
    POLICY,
    () => searchListings(brand.name, credentials, { limit: FETCHED }),
  )
  return value.filter((listing) => listing.imageUrl)
}
