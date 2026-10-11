import { TAXONOMY, findPreset } from "@/lib/niches/catalog"
import { apiError, apiOk } from "@/lib/request"

export interface BrandSheetData {
  brand: { slug: string; name: string; description: string; officialUrl: string | null }
  niches: { slug: string; name: string; palette: readonly string[]; imageUrl: string | null }[]
}

/** GET /api/brands/:slug → a verified brand and the niches it belongs to. */
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
  return apiOk<BrandSheetData>({
    brand: {
      slug: brand.slug,
      name: brand.name,
      description: brand.description,
      officialUrl: brand.officialUrl,
    },
    niches,
  })
}
