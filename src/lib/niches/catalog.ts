import { type NicheProfile, nicheProfileSchema } from "@/lib/engine/profile-schema"
import { SEED_FILES } from "./seed-files"

/**
 * Curated evergreen niches from /data/niches, bundled with the app.
 * Parsed at module load, so a malformed file fails the build instead of a page.
 * These render even when the database is unreachable.
 */
export const SEED_PROFILES: readonly NicheProfile[] = nicheProfileSchema.array().parse(SEED_FILES)

const BY_SLUG = new Map(SEED_PROFILES.map((profile) => [profile.slug, profile]))
const BY_NAME = new Map(SEED_PROFILES.map((profile) => [profile.name, profile]))

export function findSeedProfile(slug: string): NicheProfile | undefined {
  return BY_SLUG.get(slug)
}

export function findSeedProfileByName(name: string): NicheProfile | undefined {
  return BY_NAME.get(name.toLowerCase())
}

/** The lightweight card data client components need (no full profiles in the bundle). */
export interface NichePreset {
  slug: string
  name: string
  emoji: string
  tagline: string
  palette: readonly string[]
}

export const NICHE_PRESETS: readonly NichePreset[] = SEED_PROFILES.map(
  ({ slug, name, emoji, tagline, palette }) => ({ slug, name, emoji, tagline, palette }),
)
