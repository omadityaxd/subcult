import type { NicheProfile } from "@/lib/engine/profile-schema"
import type { FeedItem, FeedSource } from "./types"

/**
 * score = relevance × recencyDecay × sourceWeight × (1 + feedbackBoost)
 *
 * - relevance:   0.4 + 0.6 × min(1, keywordHits / 2), keywords = the niche's
 *                name, vibe words, artists and brands. Search-derived sources
 *                (news, video) with zero hits are off-topic noise: 0.15.
 *                Spotify is exempt (its results come from curated artists).
 * - recencyDecay: 0.5 ^ (ageHours / halfLife); timeless items (artists,
 *                playlists) get a flat 0.7
 * - sourceWeight: tunable per-source constant
 * - feedbackBoost: per-item [-1, 1] from saves / "not my vibe" (−1 hides it)
 */
export const SOURCE_WEIGHT: Record<FeedSource, number> = {
  spotify: 1,
  youtube: 0.9,
  news: 0.8,
}

/** Hours for an item's recency weight to halve. null = timeless source. */
export const HALF_LIFE_HOURS: Record<FeedSource, number | null> = {
  spotify: null,
  youtube: 24 * 7,
  news: 48,
}

const BASE_RELEVANCE = 0.4
const KEYWORD_HITS_FOR_FULL_RELEVANCE = 2
const TIMELESS_RECENCY = 0.7
const MIN_KEYWORD_LENGTH = 3
const HOUR_MS = 3_600_000

const normalize = (text: string) =>
  ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `

export function nicheKeywords(
  profile: Pick<NicheProfile, "name" | "vibeWords" | "artists" | "brands">,
): string[] {
  const raw = [
    profile.name,
    ...profile.vibeWords,
    ...profile.artists.map((artist) => artist.name),
    ...profile.brands.map((brand) => brand.name),
  ]
  const keywords = raw
    .map((word) => normalize(word).trim())
    .filter((w) => w.length >= MIN_KEYWORD_LENGTH)
  return [...new Set(keywords)]
}

/** Sources whose results come from keyword search and can drift off-topic. */
const SEARCH_DERIVED: ReadonlySet<FeedSource> = new Set(["news", "youtube"])
const OFF_TOPIC_RELEVANCE = 0.15

export function relevance(
  item: Pick<FeedItem, "source" | "title" | "subtitle">,
  keywords: readonly string[],
): number {
  const text = normalize(`${item.title} ${item.subtitle ?? ""}`)
  const hits = keywords.filter((keyword) => text.includes(` ${keyword} `)).length
  if (hits === 0 && SEARCH_DERIVED.has(item.source)) return OFF_TOPIC_RELEVANCE
  return BASE_RELEVANCE + (1 - BASE_RELEVANCE) * Math.min(1, hits / KEYWORD_HITS_FOR_FULL_RELEVANCE)
}

export function recencyDecay(item: Pick<FeedItem, "source" | "publishedAt">, now: Date): number {
  const halfLife = HALF_LIFE_HOURS[item.source]
  if (halfLife === null || !item.publishedAt) return TIMELESS_RECENCY
  const ageHours = Math.max(0, (now.getTime() - new Date(item.publishedAt).getTime()) / HOUR_MS)
  return 0.5 ** (ageHours / halfLife)
}

export interface RankContext {
  keywords: readonly string[]
  now: Date
  /** itemId → boost in [-1, 1]; populated from feedback signals in Phase 6. */
  feedback?: ReadonlyMap<string, number>
}

export function scoreItem(item: FeedItem, context: RankContext): number {
  const boost = Math.max(-1, Math.min(1, context.feedback?.get(item.id) ?? 0))
  return (
    relevance(item, context.keywords) *
    recencyDecay(item, context.now) *
    SOURCE_WEIGHT[item.source] *
    (1 + boost)
  )
}

/** Scores, drops items feedback zeroed out, sorts best-first. Stable for ties. */
export function rankFeed(items: readonly FeedItem[], context: RankContext): FeedItem[] {
  return items
    .map((item) => ({ ...item, score: scoreItem(item, context) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
}

/**
 * Keeps score order but never lets one source run longer than `maxRun` in a
 * row (no wall of five news links), unless only that source is left.
 */
export function interleave(items: readonly FeedItem[], maxRun = 2): FeedItem[] {
  const pool = [...items]
  const out: FeedItem[] = []
  while (pool.length > 0) {
    const recent = out.slice(-maxRun)
    const blocked =
      recent.length === maxRun && recent.every((item) => item.source === recent[0].source)
        ? recent[0].source
        : null
    const index = blocked ? pool.findIndex((item) => item.source !== blocked) : 0
    out.push(...pool.splice(index === -1 ? 0 : index, 1))
  }
  return out
}
