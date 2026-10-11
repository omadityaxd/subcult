import type { NicheProfile } from "@/lib/engine/profile-schema"
import { TAXONOMY, nicheArtistsLeadFirst } from "@/lib/niches/catalog"
import type { YoutubeRelevance } from "./fetchers/youtube"
import { phrasesOnly } from "./relevance"

/**
 * What counts as evidence for a niche: its verified artists (and aliases),
 * brands and collectives, plus multi-word versions of its name and aliases.
 */
export function nicheRelevance(profile: NicheProfile): YoutubeRelevance {
  const artists = nicheArtistsLeadFirst(profile.slug)
  const curation = TAXONOMY.curation(profile.slug)
  return {
    artists: artists.map((artist) => artist.name),
    terms: {
      entities: [
        ...artists.flatMap((artist) => [artist.name, ...artist.aliases]),
        ...TAXONOMY.brandsOf(profile.slug).map((brand) => brand.name),
        ...TAXONOMY.communitiesOf(profile.slug).flatMap((c) => [c.name, ...c.aliases]),
      ],
      phrases: phrasesOnly([profile.name, ...(curation?.aliases ?? [])]),
    },
  }
}
