import { z } from "zod"
import { nicheBrands } from "@/lib/feed/for-you"
import { findPreset, nicheArtistsLeadFirst } from "@/lib/niches/catalog"
import { apiError, apiOk } from "@/lib/request"

export interface StartSuggestion {
  kind: "artist" | "brand"
  slug: string
  name: string
  imageUrl: string | null
  /** Which picked niche it comes from. */
  niche: string
}

const querySchema = z.object({
  niches: z
    .string()
    .regex(/^[a-z0-9-]{1,64}(,[a-z0-9-]{1,64}){0,7}$/)
    .transform((value) => value.split(",")),
})

const PER_NICHE_ARTISTS = 2
const PER_NICHE_BRANDS = 1

/** GET /api/start?niches=a,b,c → verified artists and brands to follow, a few per niche. */
export async function GET(request: Request): Promise<Response> {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return apiError("pass ?niches=a,b,c", 400, "invalid-input")
  const seen = new Set<string>()
  const suggestions: StartSuggestion[] = []
  for (const slug of parsed.data.niches) {
    const preset = findPreset(slug)
    if (!preset) continue
    const artists = nicheArtistsLeadFirst(slug)
      .filter((artist) => artist.imageUrl && !seen.has(`artist:${artist.slug}`))
      .slice(0, PER_NICHE_ARTISTS)
    for (const artist of artists) {
      seen.add(`artist:${artist.slug}`)
      suggestions.push({
        kind: "artist",
        slug: artist.slug,
        name: artist.name,
        imageUrl: artist.imageUrl,
        niche: preset.name,
      })
    }
    for (const brand of nicheBrands(slug)
      .filter((b) => !seen.has(`brand:${b.slug}`))
      .slice(0, PER_NICHE_BRANDS)) {
      seen.add(`brand:${brand.slug}`)
      suggestions.push({
        kind: "brand",
        slug: brand.slug,
        name: brand.name,
        imageUrl: null,
        niche: preset.name,
      })
    }
  }
  return apiOk({ suggestions })
}
