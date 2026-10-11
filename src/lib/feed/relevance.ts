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
  "glaive",
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
    .replace(/[\u0300-\u036f]/g, "")
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

const channelIsEntity = (channel: string | null | undefined, terms: RelevanceTerms) =>
  !!channel && terms.entities.some((entity) => normalize(channel) === normalize(entity))

/**
 * The bar for unknown sources: the channel is the entity itself, or the
 * title names an unambiguous verified entity. Phrases and pairs of ambiguous
 * names are not enough from a source we know nothing about.
 */
export function isStrongMatch({ title, channel }: Candidate, terms: RelevanceTerms): boolean {
  if (channelIsEntity(channel, terms)) return true
  return terms.entities.some((entity) => !isAmbiguous(entity) && containsTerm(title, entity))
}

/** " - ", " – ", " — " or " | " between credits and the song/video name. */
const CREDIT_SEPARATOR = /\s[-–—|]\s/

/**
 * The bar for unknown YouTube channels: the channel is the entity, or the
 * title credits one up front ("Ken Carson - shopping (ft. Destroy Lonely)").
 * A name dropped anywhere else ("More Very Bad News For Playboi Carti") is
 * commentary or clickbait, not the scene's own content.
 */
export function isCreditMatch({ title, channel }: Candidate, terms: RelevanceTerms): boolean {
  if (channelIsEntity(channel, terms)) return true
  const parts = title.split(CREDIT_SEPARATOR)
  if (parts.length < 2) return false
  return terms.entities.some((entity) => !isAmbiguous(entity) && containsTerm(parts[0], entity))
}

/** The bar for trusted sources: any verified entity or a multi-word niche phrase. */
export function isRelevant(candidate: Candidate, terms: RelevanceTerms): boolean {
  const { title, channel } = candidate
  if (isStrongMatch(candidate, terms)) return true
  const phraseHit = terms.phrases.some(
    (phrase) => containsTerm(title, phrase) || (channel ? containsTerm(channel, phrase) : false),
  )
  if (phraseHit) return true
  // Only ambiguous names matched: need two of them to corroborate each other.
  return terms.entities.filter((entity) => containsTerm(title, entity)).length >= 2
}
