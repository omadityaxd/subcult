/**
 * Does a feed item actually belong to this niche? Only verified entities
 * (artists, brands, collectives) and multi-word niche phrases count as
 * evidence. Single scene words (rage, jerk, vamp, plugg, archive…) are too
 * ambiguous to qualify anything on their own.
 */

export interface RelevanceTerms {
  /** Verified entity names and aliases (artists, brands, collectives). */
  entities: readonly string[]
  /** Multi-word niche names/aliases ("new-gen underground rap", "opium fashion"). */
  phrases: readonly string[]
}

export interface Candidate {
  title: string
  /** Channel or outlet: a match here means the source *is* the entity. */
  channel?: string | null
}

/**
 * Names this short, or ordinary words, collide with unrelated content
 * ("Che" Guevara, "Hum" the verb, "Ride", "Bleed"). They only count when the
 * channel is the entity itself or another term corroborates them.
 */
const COMMON_WORDS = new Set([
  "bleed",
  "glare",
  "wisp",
  "hum",
  "ride",
  "korn",
  "future",
  "gunna",
  "trap",
  "rage",
  "jerk",
  "vamp",
  "plugg",
  "tread",
  "archive",
  "goth",
  "opium",
  "core",
])

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9$!]+/g, " ")
    .trim()

/** Whole-word (or whole-phrase) containment after normalization. */
export function containsTerm(text: string, term: string): boolean {
  const haystack = ` ${normalize(text)} `
  const needle = normalize(term)
  return needle.length > 0 && haystack.includes(` ${needle} `)
}

const isAmbiguous = (term: string) => {
  const value = normalize(term)
  return value.length <= 4 || COMMON_WORDS.has(value)
}

/** Keeps only multi-word phrases: a lone word is never enough evidence. */
export function phrasesOnly(candidates: readonly string[]): string[] {
  return candidates.filter((text) => normalize(text).split(" ").length >= 2)
}

export function isRelevant({ title, channel }: Candidate, terms: RelevanceTerms): boolean {
  const titleHits = terms.entities.filter((entity) => containsTerm(title, entity))
  const channelIsEntity =
    !!channel && terms.entities.some((entity) => normalize(channel) === normalize(entity))
  const phraseHit = terms.phrases.some(
    (phrase) => containsTerm(title, phrase) || (channel ? containsTerm(channel, phrase) : false),
  )
  if (channelIsEntity || phraseHit) return true
  const strong = titleHits.filter((entity) => !isAmbiguous(entity))
  if (strong.length > 0) return true
  // Only ambiguous names matched: need two of them to corroborate each other.
  return titleHits.length >= 2
}
