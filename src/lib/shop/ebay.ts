import { z } from "zod"

/**
 * eBay Browse API (https://developer.ebay.com/develop/api/buy/browse_api).
 * Application token via the client-credentials grant (scope: api_scope);
 * search with item_summary/search, details with item/{id}. Listings are live
 * data: cached briefly, never invented. With an eBay Partner Network campaign
 * id, the API returns affiliate URLs (itemAffiliateWebUrl).
 */
const API = "https://api.ebay.com"
const SCOPE = "https://api.ebay.com/oauth/api_scope"
const MARKETPLACE = "EBAY_US"
/** "Clothing, Shoes & Accessories": keeps "Rick Owens" searches to clothes. */
export const CLOTHING_CATEGORY = "11450"
const TIMEOUT_MS = 6_000
const TOKEN_MARGIN_MS = 60_000

export interface EbayCredentials {
  clientId: string
  clientSecret: string
  campaignId?: string
}

export interface Listing {
  id: string
  title: string
  price: number
  currency: string
  imageUrl: string | null
  condition: string | null
  seller: string | null
  /** Where "Buy on eBay" goes (affiliate URL when configured). */
  url: string
  createdAt: string | null
}

export interface ListingDetail extends Listing {
  images: string[]
  size: string | null
  color: string | null
  brand: string | null
}

const money = z.object({ value: z.string(), currency: z.string() })
const image = z.object({ imageUrl: z.string() })

const summarySchema = z.object({
  itemId: z.string(),
  title: z.string(),
  price: money.optional(),
  image: image.optional(),
  thumbnailImages: z.array(image).optional(),
  condition: z.string().optional(),
  seller: z.object({ username: z.string() }).optional(),
  itemWebUrl: z.string(),
  itemAffiliateWebUrl: z.string().optional(),
  itemCreationDate: z.string().optional(),
})

const searchSchema = z.object({ itemSummaries: z.array(summarySchema).optional() })

const itemSchema = summarySchema.extend({
  additionalImages: z.array(image).optional(),
  localizedAspects: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
  brand: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
})

const tokenSchema = z.object({ access_token: z.string(), expires_in: z.number() })

let token: { value: string; expiresAt: number; clientId: string } | null = null

async function appToken(credentials: EbayCredentials, fetchImpl: typeof fetch): Promise<string> {
  if (token && token.clientId === credentials.clientId && token.expiresAt > Date.now()) {
    return token.value
  }
  const basic = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString(
    "base64",
  )
  const response = await fetchImpl(`${API}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: SCOPE }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`eBay token ${response.status}`)
  const body = tokenSchema.parse(await response.json())
  token = {
    value: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000 - TOKEN_MARGIN_MS,
    clientId: credentials.clientId,
  }
  return token.value
}

async function browse(path: string, credentials: EbayCredentials, fetchImpl: typeof fetch) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await appToken(credentials, fetchImpl)}`,
    "X-EBAY-C-MARKETPLACE-ID": MARKETPLACE,
  }
  if (credentials.campaignId) {
    headers["X-EBAY-C-ENDUSERCTX"] = `affiliateCampaignId=${credentials.campaignId}`
  }
  const response = await fetchImpl(`${API}/buy/browse/v1${path}`, {
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`eBay ${response.status} for ${path.split("?")[0]}`)
  return response.json() as Promise<unknown>
}

/** eBay serves s-l225 thumbnails; ask for the same image at a size worth showing. */
export const largeImage = (url: string) => url.replace(/s-l\d+\./, "s-l1600.")
const gridImage = (url: string) => url.replace(/s-l\d+\./, "s-l500.")

function toListing(item: z.infer<typeof summarySchema>): Listing | null {
  const price = item.price ? Number(item.price.value) : NaN
  if (!Number.isFinite(price)) return null
  const raw = item.image?.imageUrl ?? item.thumbnailImages?.[0]?.imageUrl ?? null
  return {
    id: item.itemId,
    title: item.title,
    price,
    currency: item.price?.currency ?? "USD",
    imageUrl: raw ? gridImage(raw) : null,
    condition: item.condition ?? null,
    seller: item.seller?.username ?? null,
    url: item.itemAffiliateWebUrl ?? item.itemWebUrl,
    createdAt: item.itemCreationDate ?? null,
  }
}

export async function searchListings(
  query: string,
  credentials: EbayCredentials,
  { limit = 24, fetchImpl = fetch }: { limit?: number; fetchImpl?: typeof fetch } = {},
): Promise<Listing[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    category_ids: CLOTHING_CATEGORY,
    filter: "buyingOptions:{FIXED_PRICE|AUCTION}",
  })
  const body = searchSchema.parse(
    await browse(`/item_summary/search?${params}`, credentials, fetchImpl),
  )
  return (body.itemSummaries ?? []).flatMap((item) => toListing(item) ?? [])
}

export async function getListing(
  id: string,
  credentials: EbayCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<ListingDetail | null> {
  const item = itemSchema.parse(
    await browse(`/item/${encodeURIComponent(id)}`, credentials, fetchImpl),
  )
  const listing = toListing(item)
  if (!listing) return null
  const aspect = (name: string) =>
    item.localizedAspects?.find((entry) => entry.name.toLowerCase() === name)?.value ?? null
  const images = [item.image, ...(item.additionalImages ?? [])]
    .flatMap((entry) => (entry ? [largeImage(entry.imageUrl)] : []))
    .filter((url, i, all) => all.indexOf(url) === i)
  return {
    ...listing,
    images,
    size: item.size ?? aspect("size") ?? aspect("size (men's)") ?? aspect("size (women's)"),
    color: item.color ?? aspect("color"),
    brand: item.brand ?? aspect("brand"),
  }
}
