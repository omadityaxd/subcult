import { z } from "zod"
import INSTAGRAM from "../../../data/taxonomy/instagram.json"
import { nicheBrands } from "@/lib/feed/for-you"
import { nicheArtistsLeadFirst } from "@/lib/niches/catalog"
import type { FollowCard } from "./follow"

/**
 * Verified Instagram handles (scripts/verify-instagram.ts). Artists need
 * Wikidata and MusicBrainz to agree; brands need their own site to link the
 * profile. Unverified handles never get here.
 */
const evidence = z.object({
  handle: z.string().regex(/^[a-z0-9._]{1,30}$/),
  sources: z.array(z.string().url()).min(1),
})
const fileSchema = z.object({
  verifiedAt: z.string(),
  artists: z.record(z.string(), evidence),
  brands: z.record(z.string(), evidence),
})

const VERIFIED = fileSchema.parse(INSTAGRAM)
const FOLLOW_MAX = 10

/** A niche's "who to follow": its verified artists, then the brands that dress it. */
export function whoToFollow(slug: string): FollowCard[] {
  const artists = nicheArtistsLeadFirst(slug).flatMap((artist): FollowCard[] => {
    const found = VERIFIED.artists[artist.slug]
    return found
      ? [
          {
            kind: "artist",
            slug: artist.slug,
            name: artist.name,
            handle: found.handle,
            imageUrl: artist.imageUrl,
            sources: found.sources,
          },
        ]
      : []
  })
  const brands = nicheBrands(slug).flatMap((brand): FollowCard[] => {
    const found = VERIFIED.brands[brand.slug]
    return found
      ? [
          {
            kind: "brand",
            slug: brand.slug,
            name: brand.name,
            handle: found.handle,
            imageUrl: null,
            sources: found.sources,
          },
        ]
      : []
  })
  // Interleave so a fashion niche doesn't show only brands, or a music niche only artists.
  const out: FollowCard[] = []
  for (let i = 0; out.length < FOLLOW_MAX && (i < artists.length || i < brands.length); i++) {
    if (artists[i]) out.push(artists[i])
    if (brands[i] && out.length < FOLLOW_MAX) out.push(brands[i])
  }
  return out
}
