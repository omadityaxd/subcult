import { hashSeed } from "@/lib/design/cover"
import { SEED_PROFILES, TAXONOMY, nicheImage } from "@/lib/niches/catalog"

export interface HomeNiche {
  slug: string
  name: string
  tagline: string
  palette: string[]
  /** Top verified artist's photo; the gradient monogram is the fallback. */
  imageUrl: string | null
}

export const utcDay = (now: Date): string => now.toISOString().slice(0, 10)

const toHomeNiche = ({ slug, name, tagline, palette }: (typeof SEED_PROFILES)[number]) => ({
  slug,
  name,
  tagline,
  palette,
  imageUrl: nicheImage(slug),
})

/**
 * Guest home order: the featured cluster first (in its curated order), then
 * every other curated niche shuffled deterministically per UTC day, so the
 * tail changes daily but stays stable while you scroll.
 */
export function featuredOrder(now: Date = new Date()): HomeNiche[] {
  const day = utcDay(now)
  const featured = TAXONOMY.featured()
  const rank = new Map(featured.map((slug, index) => [slug, index]))
  const rest = SEED_PROFILES.filter((profile) => !rank.has(profile.slug)).sort(
    (a, b) => hashSeed(`${a.slug}:${day}`) - hashSeed(`${b.slug}:${day}`),
  )
  const lead = SEED_PROFILES.filter((profile) => rank.has(profile.slug)).sort(
    (a, b) => (rank.get(a.slug) ?? 0) - (rank.get(b.slug) ?? 0),
  )
  return [...lead, ...rest].map(toHomeNiche)
}
