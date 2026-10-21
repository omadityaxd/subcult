import { z } from "zod"
import artistsData from "../../../../data/taxonomy/artists.json"
import brandsData from "../../../../data/taxonomy/brands.json"
import { getDb } from "@/db"
import { listFits } from "@/db/fit-repository"
import { cached } from "@/lib/feed/cache"
import { isExcludedContent } from "@/lib/feed/excluded"
import { toViews } from "@/lib/fits/server"
import { errorMessage, log } from "@/lib/log"
import { type Preview, searchSongs, toPreview } from "@/lib/music/itunes"
import { getCacheStore } from "@/lib/music/server"
import { TAXONOMY, findPreset } from "@/lib/niches/catalog"
import { getLimiter } from "@/lib/rate-limit"
import { apiError, apiOk, clientIp } from "@/lib/request"
import { searchEntities } from "@/lib/search/match"
import { brandListings } from "@/lib/shop/look-server"
import { fetchGoogleNews } from "@/lib/sources/google-news"

const ARTISTS = 5
const BRANDS = 4
const TRACKS = 5
const FITS = 6
const HEADLINES = 5
/** A slow source drops out of the results rather than holding them up. */
const SOURCE_BUDGET_MS = 3000
const SONGS_POLICY = { freshSeconds: 24 * 3600, staleSeconds: 7 * 24 * 3600 }
const NEWS_POLICY = { freshSeconds: 3600, staleSeconds: 24 * 3600 }

const querySchema = z.object({ q: z.string().trim().min(2).max(60) })

export interface SearchResults {
  artists: { slug: string; name: string; imageUrl: string | null; niche: string | null }[]
  /** listings: live eBay count, or null when listings aren't switched on. */
  brands: { slug: string; name: string; listings: number | null }[]
  tracks: (Preview & { id: string })[]
  fits: { id: string; handle: string; imageUrl: string; caption: string | null }[]
  headlines: { title: string; url: string; outlet: string | null; imageUrl: string | null }[]
}

async function within<T>(label: string, work: Promise<T>, fallback: T): Promise<T> {
  try {
    return await Promise.race([
      work,
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), SOURCE_BUDGET_MS)),
    ])
  } catch (error) {
    log.warn("search.source_failed", { source: label, error: errorMessage(error) })
    return fallback
  }
}

const cacheKey = (q: string) => encodeURIComponent(q.toLowerCase())

async function tracksFor(q: string): Promise<SearchResults["tracks"]> {
  const { value } = await cached(
    getCacheStore(),
    `subcult:search-songs:v1:${cacheKey(q)}`,
    SONGS_POLICY,
    async () => (await searchSongs({ term: q, limit: String(TRACKS * 2) }, {})).map(toPreview),
  )
  return value
    .slice(0, TRACKS)
    .map((preview) => ({ ...preview, id: `search:${preview.previewUrl}` }))
}

async function headlinesFor(q: string): Promise<SearchResults["headlines"]> {
  const { value } = await cached(
    getCacheStore(),
    `subcult:search-news:v1:${cacheKey(q)}`,
    NEWS_POLICY,
    async () =>
      (await fetchGoogleNews(q, { days: 14 }))
        .filter((article) => !isExcludedContent(article.title))
        .slice(0, HEADLINES)
        .map(({ title, url, outlet, imageUrl }) => ({ title, url, outlet, imageUrl })),
  )
  return value
}

async function fitsFor(q: string): Promise<SearchResults["fits"]> {
  const db = getDb()
  if (!db) return []
  const views = await toViews(await listFits(db, { search: q, limit: FITS }), null)
  return views.map((fit) => ({
    id: fit.id,
    handle: fit.handle,
    imageUrl: fit.imageUrl,
    caption: fit.caption,
  }))
}

/**
 * GET /api/search?q= → everything that matches, grouped: artists, brands
 * (with live listing counts when listings are on), playable tracks, fits
 * and headlines. Niches are matched on the client from the catalog.
 */
export async function GET(request: Request): Promise<Response> {
  const limit = await getLimiter("search", 60, "1 m").limit(clientIp(request.headers))
  if (!limit.success) return apiError("slow down a little", 429, "rate-limited")
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return apiError("type at least two characters", 400, "invalid-input")
  const q = parsed.data.q

  const artists = searchEntities(q, artistsData, ARTISTS).map((artist) => {
    const niche = TAXONOMY.nichesOfArtist(artist.slug)[0]
    return {
      slug: artist.slug,
      name: artist.name,
      imageUrl: artist.imageUrl ?? null,
      niche: niche ? (findPreset(niche)?.name ?? null) : null,
    }
  })
  const matchedBrands = searchEntities(q, brandsData, BRANDS)
  const [brandCounts, tracks, fits, headlines] = await Promise.all([
    within(
      "brands",
      Promise.all(matchedBrands.map(async (brand) => (await brandListings(brand))?.length ?? null)),
      matchedBrands.map(() => null),
    ),
    within("tracks", tracksFor(q), []),
    within("fits", fitsFor(q), []),
    within("headlines", headlinesFor(q), []),
  ])
  const brands = matchedBrands.map((brand, i) => ({
    slug: brand.slug,
    name: brand.name,
    listings: brandCounts[i] ?? null,
  }))
  return apiOk({ artists, brands, tracks, fits, headlines } satisfies SearchResults)
}
