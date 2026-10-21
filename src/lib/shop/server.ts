import "server-only"
import { cache } from "react"
import { cached } from "@/lib/feed/cache"
import { nicheBrands } from "@/lib/feed/for-you"
import { TAXONOMY } from "@/lib/niches/catalog"
import type { FeedItem } from "@/lib/feed/types"
import { env } from "@/lib/env"
import { errorMessage, log } from "@/lib/log"
import { getCacheStore } from "@/lib/music/server"
import { memoryQuota, redisQuota } from "@/lib/feed/quota"
import { EBAY_DAILY_CALLS } from "./quota"
import { getRedis } from "@/lib/redis"
import { type BrandArchive, brandArchive } from "./archive"
import { type EbayCredentials, type ListingDetail, getListing, searchListings } from "./ebay"

/** Listings change fast; eBay asks apps not to show stale data, so cache briefly. */
const LISTINGS_POLICY = { freshSeconds: 3 * 3600, staleSeconds: 6 * 3600 }
const DETAIL_POLICY = { freshSeconds: 3600, staleSeconds: 3 * 3600 }
const ARCHIVE_BRANDS = 5
const PER_BRAND = 20

const localEbayQuota = memoryQuota(EBAY_DAILY_CALLS)

export function ebayCredentials(): EbayCredentials | null {
  if (!env.EBAY_CLIENT_ID || !env.EBAY_CLIENT_SECRET) return null
  const redis = getRedis()
  return {
    clientId: env.EBAY_CLIENT_ID,
    clientSecret: env.EBAY_CLIENT_SECRET,
    campaignId: env.EBAY_CAMPAIGN_ID,
    // Shared across every serverless instance (Redis); per-process in local dev without it.
    quota: redis ? redisQuota(redis, "ebay:calls", EBAY_DAILY_CALLS) : localEbayQuota,
  }
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
    .flatMap((archive) =>
      archive.eras.flatMap((era) =>
        era.listings.map((listing) => ({ ...listing, brandSlug: archive.brandSlug })),
      ),
    )
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
        brandSlug: listing.brandSlug,
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

/** One brand's live archive (brand sheet). Null without eBay. */
export async function getBrandArchive(brandSlug: string): Promise<BrandArchive | null> {
  const credentials = ebayCredentials()
  const brand = TAXONOMY.brand(brandSlug)
  if (!credentials || !brand) return null
  return brandArchive(brand, await brandListings(brand, credentials))
}
