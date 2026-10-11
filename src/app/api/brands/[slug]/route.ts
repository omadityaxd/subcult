import { errorMessage, log } from "@/lib/log"
import { getBrandBoard } from "@/lib/moodboard/server"
import type { Pin } from "@/lib/moodboard/types"
import { TAXONOMY, findPreset } from "@/lib/niches/catalog"
import { apiError, apiOk } from "@/lib/request"
import type { BrandArchive } from "@/lib/shop/archive"
import { getBrandArchive } from "@/lib/shop/server"

export interface BrandSheetData {
  brand: { slug: string; name: string; description: string; officialUrl: string | null }
  niches: { slug: string; name: string; palette: readonly string[]; imageUrl: string | null }[]
  /** Verified artists associated with wearing it, each with the source of the claim. */
  artists: { slug: string; name: string; imageUrl: string | null; note: string; source: string }[]
  /** Live eBay listings, by era. Null when the shop isn't connected. */
  archive: BrandArchive | null
  /** Photography for the brand (Unsplash/Pexels); empty without keys. */
  board: Pin[]
}

/** GET /api/brands/:slug → a brand as a first-class entity. */
export async function GET(_request: Request, ctx: RouteContext<"/api/brands/[slug]">) {
  const { slug } = await ctx.params
  const brand = TAXONOMY.brand(slug)
  if (!brand) return apiError("no such brand", 404, "invalid-input")

  const niches = TAXONOMY.nichesOfBrand(slug).flatMap((niche) => {
    const preset = findPreset(niche)
    return preset
      ? [
          {
            slug: preset.slug,
            name: preset.name,
            palette: preset.palette,
            imageUrl: preset.imageUrl,
          },
        ]
      : []
  })
  const artists = brand.wornBy.flatMap((entry) => {
    const artist = TAXONOMY.artist(entry.artist)
    return artist
      ? [
          {
            slug: artist.slug,
            name: artist.name,
            imageUrl: artist.imageUrl,
            note: entry.note,
            source: entry.source,
          },
        ]
      : []
  })
  const [archive, board] = await Promise.all([
    getBrandArchive(slug).catch((error: unknown) => {
      log.warn("api.brands.archive_failed", { slug, error: errorMessage(error) })
      return null
    }),
    getBrandBoard(brand.name, slug),
  ])

  return apiOk<BrandSheetData>({
    brand: {
      slug: brand.slug,
      name: brand.name,
      description: brand.description,
      officialUrl: brand.officialUrl,
    },
    niches,
    artists,
    archive,
    board,
  })
}
