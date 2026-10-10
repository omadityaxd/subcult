import artists from "../../../data/taxonomy/artists.json"
import brands from "../../../data/taxonomy/brands.json"
import communities from "../../../data/taxonomy/communities.json"
import edges from "../../../data/taxonomy/edges.json"
import hubs from "../../../data/taxonomy/hubs.json"
import nicheCurations from "../../../data/taxonomy/niches.json"
import tags from "../../../data/taxonomy/tags.json"
import { type NicheProfile, nicheProfileSchema } from "@/lib/engine/profile-schema"
import { type Taxonomy, buildTaxonomy } from "@/lib/taxonomy/graph"
import { taxonomyFilesSchema } from "@/lib/taxonomy/schema"
import { SEED_FILES } from "./seed-files"

/**
 * Curated evergreen niches from /data/niches, bundled with the app.
 * Parsed at module load, so a malformed file fails the build instead of a page.
 * These render even when the database is unreachable.
 */
export const SEED_PROFILES: readonly NicheProfile[] = nicheProfileSchema.array().parse(SEED_FILES)

/**
 * The subculture graph around those niches (/data/taxonomy): hubs, tags,
 * verified artists, brands, collectives and typed relationships. Validated at
 * module load too: a dangling edge or duplicate alias fails the build.
 */
export const TAXONOMY: Taxonomy = buildTaxonomy({
  profiles: SEED_PROFILES,
  files: taxonomyFilesSchema.parse({
    hubs,
    niches: nicheCurations,
    edges,
    tags,
    artists,
    brands,
    communities,
  }),
})

const BY_SLUG = new Map(SEED_PROFILES.map((profile) => [profile.slug, profile]))

export function findSeedProfile(slug: string): NicheProfile | undefined {
  return BY_SLUG.get(slug)
}

/** Name, alias or slug ("Opium Fashion", "opium-fashion") → curated profile. */
export function findSeedProfileByName(name: string): NicheProfile | undefined {
  const slug = TAXONOMY.resolve(name, "niche")
  return slug ? BY_SLUG.get(slug) : undefined
}

/** The lightweight card data client components need (no full profiles in the bundle). */
export interface NichePreset {
  slug: string
  name: string
  emoji: string
  tagline: string
  palette: readonly string[]
  /** Search aliases ("opium fashion" finds vamp). */
  aliases: readonly string[]
  /** The top verified artist's photo; the generative cover is the fallback. */
  imageUrl: string | null
  featuredOrder: number | null
}

/**
 * Each niche's stand-in photo (avatars, card covers): its first verified
 * artist with a photo that no earlier niche has claimed, so a grid never
 * repeats the same face. Featured niches pick first. Falls back to the first
 * photo if every one is taken, and to null (generative cover) if none exist.
 */
const NICHE_IMAGES: ReadonlyMap<string, string | null> = (() => {
  const featured = new Map(TAXONOMY.featured().map((slug, index) => [slug, index]))
  const order = [...SEED_PROFILES].sort(
    (a, b) => (featured.get(a.slug) ?? Infinity) - (featured.get(b.slug) ?? Infinity),
  )
  const used = new Set<string>()
  const images = new Map<string, string | null>()
  for (const { slug } of order) {
    const photos = TAXONOMY.artistsOf(slug).flatMap((artist) =>
      artist.imageUrl ? [artist.imageUrl] : [],
    )
    const pick = photos.find((url) => !used.has(url)) ?? photos[0] ?? null
    if (pick) used.add(pick)
    images.set(slug, pick)
  }
  return images
})()

export function nicheImage(slug: string): string | null {
  return NICHE_IMAGES.get(slug) ?? null
}

export function toPreset({ slug, name, emoji, tagline, palette }: NicheProfile): NichePreset {
  const curation = TAXONOMY.curation(slug)
  return {
    slug,
    name,
    emoji,
    tagline,
    palette,
    aliases: curation?.aliases ?? [],
    imageUrl: nicheImage(slug),
    featuredOrder: curation?.featuredOrder ?? null,
  }
}

/** Featured niches first (in featuredOrder), then the rest in catalog order. */
export const NICHE_PRESETS: readonly NichePreset[] = SEED_PROFILES.map(toPreset).sort(
  (a, b) => (a.featuredOrder ?? Infinity) - (b.featuredOrder ?? Infinity),
)

export function findPreset(slug: string): NichePreset | undefined {
  return NICHE_PRESETS.find((preset) => preset.slug === slug)
}

/** Verified Spotify ID for an artist name or alias, if the taxonomy has confirmed one. */
export function artistSpotifyId(name: string): string | undefined {
  const slug = TAXONOMY.resolve(name, "artist")
  return slug ? TAXONOMY.artist(slug)?.spotifyId : undefined
}
