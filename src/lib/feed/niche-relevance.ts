import { GLOW_UP_HUB } from "./excluded"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { TAXONOMY, nicheArtistsLeadFirst } from "@/lib/niches/catalog"
import type { CleanContext } from "./clean"
import type { YoutubeRelevance } from "./fetchers/youtube"
import { phrasesOnly } from "./relevance"
import { sourcesForBranch } from "./source-tiers"

/**
 * Niches outside the taxonomy have no curation entry; these are the ones
 * whose scene isn't English-first.
 */
const LEGACY_LANGUAGES: Readonly<Record<string, readonly string[]>> = {
  "k-pop": ["en", "ko"],
  "city-pop": ["en", "ja"],
  anime: ["en", "ja"],
}

/**
 * What counts as evidence for a niche: its verified artists (and aliases),
 * brands and collectives, plus multi-word versions of its name and aliases.
 * Niches outside the taxonomy fall back to their profile's artists and brands.
 */
export function nicheRelevance(profile: NicheProfile): YoutubeRelevance {
  const artists = nicheArtistsLeadFirst(profile.slug)
  const curation = TAXONOMY.curation(profile.slug)
  const phrases = phrasesOnly([profile.name, ...(curation?.aliases ?? [])])
  if (artists.length === 0) {
    const names = profile.artists.map((artist) => artist.name)
    return {
      artists: names,
      terms: { entities: [...names, ...profile.brands.map((brand) => brand.name)], phrases },
    }
  }
  return {
    artists: artists.map((artist) => artist.name),
    terms: {
      entities: [
        ...artists.flatMap((artist) => [artist.name, ...artist.aliases]),
        ...TAXONOMY.brandsOf(profile.slug).map((brand) => brand.name),
        ...TAXONOMY.communitiesOf(profile.slug).flatMap((c) => [c.name, ...c.aliases]),
      ],
      phrases,
    },
  }
}

/** Everything the relevance pipeline needs to judge items for this niche. */
export function nicheCleanContext(profile: NicheProfile): CleanContext {
  const curation = TAXONOMY.curation(profile.slug)
  const { terms } = nicheRelevance(profile)
  const hasEvidence = terms.entities.length > 0 || terms.phrases.length > 0
  return {
    terms: hasEvidence ? terms : null,
    negativeKeywords: curation?.negativeKeywords ?? [],
    languages: curation?.languages ?? LEGACY_LANGUAGES[profile.slug] ?? ["en"],
    sources: sourcesForBranch(TAXONOMY.branchOf(profile.slug)),
    glowUp: TAXONOMY.parents(profile.slug).includes(GLOW_UP_HUB),
  }
}
