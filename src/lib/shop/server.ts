import "server-only"
import { cache } from "react"
import { cached } from "@/lib/feed/cache"
import { nicheBrands } from "@/lib/feed/for-you"
import type { FeedItem } from "@/lib/feed/types"
import { env } from "@/lib/env"
import { errorMessage, log } from "@/lib/log"
import { getCacheStore } from "@/lib/music/server"
import { type BrandArchive, brandArchive } from "./archive"
import { type EbayCredentials, type ListingDetail, getListing, searchListings } from "./ebay"

/** Listings change fast; eBay asks apps not to show stale data, so cache briefly. */
const LISTINGS_POLICY = { freshSeconds: 3 * 3600, staleSeconds: 6 * 3600 }
const DETAIL_POLICY = { freshSeconds: 3600, staleSeconds: 3 * 3600 }
const ARCHIVE_BRANDS = 5
const PER_BRAND = 20

export function ebayCredentials(): EbayCredentials | null {
  return env.EBAY_CLIENT_ID && env.EBAY_CLIENT_SECRET
    ? {
        clientId: env.EBAY_CLIENT_ID,
        clientSecret: env.EBAY_CLIENT_SECRET,
        campaignId: env.EBAY_CAMPAIGN_ID,
      }
    : null
}

const onStoreError = (operation: string, error: unknown) =>
  log.warn("shop.cache_error", { operation, error: errorMessage(error) })

/** One brand's live listings, cached. */
async function brandListings(brand: { name: string; slug: string }, credentials: EbayCredentials) {
  const { value } = await cached(
    getCacheStore(),
    `subcult:ebay:v1:brand:${brand.slug}`,
    LISTINGS_POLICY,
    () => searchListings(brand.name, credentials, { limit: PER_BRAND }),
    { onStoreError },
  )
  return value
}

/**
 * A niche's archive: its brands' live listings, grouped by brand and era.
 * Null when eBay isn't configured (the tab says so; nothing is faked).
 */
export const getArchive = cache(async (slug: string): Promise<BrandArchive[] | null> => {
  const credentials = ebayCredentials()
  if (!credentials) return null
  const brands = nicheBrands(slug).slice(0, ARCHIVE_BRANDS)
  const results = await Promise.allSettled(
    brands.map(async (brand) => brandArchive(brand, await brandListings(brand, credentials))),
  )
  return results.flatMap((result, i) => {
    if (result.status === "fulfilled") return result.value.priceRange ? [result.value] : []
    log.warn("shop.archive_failed", { brand: brands[i]?.slug, error: errorMessage(result.reason) })
    return []
  })
})

/** Archive listings as For You fashion cards (grails first). */
export function archiveFeedItems(archives: readonly BrandArchive[]): FeedItem[] {
  return archives
    .flatMap((archive) => archive.eras.flatMap((era) => era.listings))
    .sort((a, b) => Number(b.grail) - Number(a.grail))
    .map((listing) => ({
      id: `ebay:${listing.id}`,
      source: "ebay" as const,
      type: "product" as const,
      title: listing.title,
      subtitle: listing.brand,
      imageUrl: listing.imageUrl,
      url: listing.url,
      publishedAt: listing.createdAt,
      score: 1,
      meta: {
        listingId: listing.id,
        price: listing.price,
        currency: listing.currency,
        condition: listing.condition,
        era: listing.era,
        season: listing.season,
        grail: listing.grail,
      },
    }))
}

/** Full listing for the product sheet (gallery, size), cached briefly. */
export async function getListingDetail(id: string): Promise<ListingDetail | null> {
  const credentials = ebayCredentials()
  if (!credentials) return null
  const { value } = await cached(
    getCacheStore(),
    `subcult:ebay:v1:item:${id}`,
    DETAIL_POLICY,
    () => getListing(id, credentials),
    { onStoreError },
  )
  return value
}
