import { hashSeed } from "@/lib/design/cover"
import { SEED_PROFILES } from "@/lib/niches/catalog"

export interface HomeNiche {
  slug: string
  name: string
  tagline: string
  palette: string[]
}

export const utcDay = (now: Date): string => now.toISOString().slice(0, 10)

/**
 * Guest home order: every curated niche, shuffled deterministically per UTC
 * day so the feed changes daily but stays stable while you scroll.
 */
export function featuredOrder(now: Date = new Date()): HomeNiche[] {
  const day = utcDay(now)
  return [...SEED_PROFILES]
    .sort((a, b) => hashSeed(`${a.slug}:${day}`) - hashSeed(`${b.slug}:${day}`))
    .map(({ slug, name, tagline, palette }) => ({ slug, name, tagline, palette }))
}
