import {
  type RelevanceTerms,
  containsTerm,
  isCreditMatch,
  isRelevant,
  isStrongMatch,
} from "./relevance"
import { BLOCKED_NEWS_DOMAINS, type SourceAllowlist, domainIn } from "./source-tiers"
import type { FeedItem, FeedSource } from "./types"

/**
 * The relevance pipeline every niche feed goes through before ranking:
 * spam → language/region → negative keywords → source tier + entity match →
 * dedupe. It runs on read, so a fix here applies to cached items too.
 */
export interface CleanContext {
  /** Evidence for the niche; null skips the entity gate (nothing to match on). */
  terms: RelevanceTerms | null
  /** Phrases that disqualify an item for this niche ("opium war", "type beat"). */
  negativeKeywords: readonly string[]
  /** ISO 639-1 codes the niche is in; English-only unless the niche says otherwise. */
  languages: readonly string[]
  sources: SourceAllowlist
}

export type DropReason =
  "spam" | "language" | "region" | "negative" | "blocked" | "irrelevant" | "duplicate"

/** Open-web sources whose items must earn their place; Spotify and in-app cards are verified upstream. */
const GATED_SOURCES: ReadonlySet<FeedSource> = new Set(["youtube", "news"])

/** Producer uploads and tutorials: never scene content, whatever artist they name-drop. */
const SPAM_PATTERNS: readonly RegExp[] = [
  /\btype ?beats?\b/,
  /\bfree\b.*\bbeats?\b/,
  /\bmade (a|an|this|the)\b.*\bbeats?\b/,
  /\bmaking (a|an|the)?\s*beats?\b/,
  /\bhow to make\b/,
  /\bfl studio\b/,
  /\b(drum|loop|sample|vocal) (kit|pack)s?\b/,
  /\bbeat (tape|tutorial|breakdown)\b/,
  // AI voice covers and fake "AI" songs.
  /\(ai\)|\bai (cover|song|version)\b/,
]

/** Regional scene compilations the English feed shouldn't surface. */
const REGION_MARKERS: readonly string[] = [
  "odia",
  "odisha",
  "bhojpuri",
  "punjabi",
  "haryanvi",
  "tamil",
  "telugu",
  "kannada",
  "malayalam",
  "marathi",
  "bangla",
  "nepali",
  "viet",
  "vietnam",
  "vietnamese",
]

/** Function words that only show up in Spanish/Portuguese titles; two hits = not English. */
const ROMANCE_WORDS = new Set([
  "que",
  "para",
  "con",
  "los",
  "las",
  "una",
  "nao",
  "voce",
  "musica",
  "nuevo",
  "nueva",
  "cancion",
  "mejor",
  "letra",
  "ao",
  "vivo",
  "pra",
  "esta",
])

const lower = (text: string) => text.toLowerCase().normalize("NFKD")

/** Languages a title is (at least partly) written in, beyond English. */
export function foreignLanguages(title: string): Set<string> {
  const found = new Set<string>()
  if (/\p{Script=Hangul}/u.test(title)) found.add("ko")
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(title)) found.add("ja")
  if (/\p{Script=Han}/u.test(title)) found.add("cjk")
  // Vietnamese: Latin Extended Additional plus đ/ơ/ư ("Việt").
  if (/[\u1EA0-\u1EF9\u0111\u0110\u01A1\u01A0\u01B0\u01AF]/u.test(title)) found.add("vi")
  if (
    /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(
      title,
    )
  ) {
    found.add("other")
  }
  const words = lower(title)
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z]+/)
  if (words.filter((word) => ROMANCE_WORDS.has(word)).length >= 2) found.add("romance")
  return found
}

function inAllowedLanguage(title: string, languages: readonly string[]): boolean {
  const allowed = new Set(languages)
  const cjkOk = allowed.has("ja") || allowed.has("ko") || allowed.has("zh")
  for (const language of foreignLanguages(title)) {
    if (language === "cjk" ? !cjkOk : !allowed.has(language)) return false
  }
  return true
}

const isSpam = (title: string) => {
  const text = lower(title)
  return SPAM_PATTERNS.some((pattern) => pattern.test(text))
}

const channelOf = (item: FeedItem) =>
  typeof item.meta.channel === "string" ? item.meta.channel : item.subtitle

const domainOf = (item: FeedItem) =>
  typeof item.meta.domain === "string" ? item.meta.domain : null

/** Is this item from a source on the niche's branch allowlist? */
export function isTrusted(item: FeedItem, sources: SourceAllowlist): boolean {
  if (item.source === "news") return domainIn(domainOf(item), sources.newsDomains)
  if (item.source === "youtube") return sources.channels.has((channelOf(item) ?? "").toLowerCase())
  return true
}

/** Why an item doesn't belong in this niche's feed, or null when it does. */
export function judgeItem(item: FeedItem, ctx: CleanContext): DropReason | null {
  if (!GATED_SOURCES.has(item.source)) return null
  const { title } = item
  if (isSpam(title)) return "spam"
  if (!inAllowedLanguage(title, ctx.languages)) return "language"
  const englishOnly = ctx.languages.every((language) => language === "en")
  if (englishOnly && REGION_MARKERS.some((marker) => containsTerm(title, marker))) return "region"
  if (ctx.negativeKeywords.some((keyword) => containsTerm(title, keyword))) return "negative"
  if (item.source === "news" && domainIn(domainOf(item), BLOCKED_NEWS_DOMAINS)) return "blocked"
  if (!ctx.terms) return null
  const candidate = { title, channel: item.source === "youtube" ? channelOf(item) : null }
  // Unknown sources clear a higher bar: a named entity for news, a credited one for video.
  const unknownBar = item.source === "youtube" ? isCreditMatch : isStrongMatch
  const relevant = isTrusted(item, ctx.sources)
    ? isRelevant(candidate, ctx.terms)
    : unknownBar(candidate, ctx.terms)
  return relevant ? null : "irrelevant"
}

const TRACKING_PARAM = /^(utm_|fbclid$|gclid$|igshid$|mc_[ce]id$|ref$|ref_src$|si$|feature$)/

/** One key per piece of content: YouTube by video id, everything else by cleaned URL. */
export function canonicalUrl(raw: string): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return raw.trim()
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "")
  if (host === "youtu.be") return `youtube:${url.pathname.slice(1)}`
  if (host.endsWith("youtube.com") || host === "youtube-nocookie.com") {
    const id = url.searchParams.get("v") ?? url.pathname.match(/\/(?:shorts|embed)\/([^/?]+)/)?.[1]
    if (id) return `youtube:${id}`
  }
  const params = [...url.searchParams]
    .filter(([key]) => !TRACKING_PARAM.test(key.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b))
  const query = params.length > 0 ? `?${new URLSearchParams(params)}` : ""
  return `${host}${url.pathname.replace(/\/+$/, "")}${query}`
}

const titleTokens = (title: string) =>
  new Set(
    lower(title)
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 1),
  )

export const NEAR_DUPLICATE = 0.8

/** Token Jaccard similarity: syndicated copies and re-ups score ~0.8–1. */
export function titleSimilarity(a: string, b: string): number {
  const left = titleTokens(a)
  const right = titleTokens(b)
  if (left.size === 0 || right.size === 0) return 0
  let shared = 0
  for (const token of left) if (right.has(token)) shared += 1
  return shared / (left.size + right.size - shared)
}

/**
 * Keeps one copy of each piece of content (same canonical URL or a
 * near-identical title within a source lane). When copies differ in trust,
 * the trusted source's copy wins.
 */
export function dedupe(items: readonly FeedItem[], sources: SourceAllowlist): FeedItem[] {
  const kept: FeedItem[] = []
  const urls = new Map<string, number>()
  for (const item of items) {
    const url = canonicalUrl(item.url)
    const index =
      urls.get(url) ??
      kept.findIndex(
        (other) =>
          other.source === item.source &&
          titleSimilarity(other.title, item.title) >= NEAR_DUPLICATE,
      )
    if (index === undefined || index < 0) {
      urls.set(url, kept.length)
      kept.push(item)
    } else if (isTrusted(item, sources) && !isTrusted(kept[index], sources)) {
      urls.set(url, index)
      kept[index] = item
    }
  }
  return kept
}

/** The pipeline: drop what doesn't belong, then dedupe what's left. */
export function cleanFeed(items: readonly FeedItem[], ctx: CleanContext): FeedItem[] {
  return dedupe(
    items.filter((item) => judgeItem(item, ctx) === null),
    ctx.sources,
  )
}
