import { mixKind } from "@/lib/feed/mix"
import type { FeedItem } from "@/lib/feed/types"
import { type EntityRef, entitiesOfItem, entityType } from "./entities"
import type { Affinity, TasteVector } from "./model"

/**
 * Ranking: base score × affinity × novelty, inside the content mix. Items
 * only trade places with items of the same mix kind, so personalization
 * never breaks the mix rules (music cap, news share, …).
 */

/** How much each entity type speaks for a card (a niche is broad, an artist specific). */
const TYPE_WEIGHT: Record<ReturnType<typeof entityType>, number> = {
  artist: 1,
  brand: 1,
  tag: 0.6,
  niche: 0.5,
}
/** Affinity's pull on the order: at most ×(1 + AFFINITY_PULL). */
const AFFINITY_PULL = 1.5
const AFFINITY_SCALE = 6
/** Already opened/saved: show something new first. */
const SEEN_PENALTY = 0.6
/** "Not my vibe" territory: hide outright below this. */
const HIDE_BELOW = -3
/** Share of pages that come from two-hop niches. */
export const EXPLORATION_SHARE = 0.15

/** The card's affinity: its strongest weighted entity (positive or negative). */
export function itemAffinity(
  item: FeedItem,
  vector: TasteVector,
  niche: string | null = null,
): { score: number; via: Affinity | null } {
  let best: { score: number; via: Affinity | null } = { score: 0, via: null }
  for (const ref of entitiesOfItem(item, niche)) {
    const affinity = vector.get(ref)
    if (!affinity) continue
    const score = affinity.score * TYPE_WEIGHT[entityType(ref)]
    if (Math.abs(score) > Math.abs(best.score)) best = { score, via: affinity }
  }
  return best
}

export function personalScore(
  item: FeedItem,
  vector: TasteVector,
  seen: ReadonlySet<string>,
  niche: string | null = null,
): number {
  const { score } = itemAffinity(item, vector, niche)
  const affinity = 1 + AFFINITY_PULL * Math.tanh(score / AFFINITY_SCALE)
  const novelty = seen.has(item.id) ? SEEN_PENALTY : 1
  return Math.max(item.score, 0.01) * Math.max(affinity, 0.05) * novelty
}

/**
 * Re-ranks one page: drops "not my vibe" items, then refills each mix
 * kind's slots with that kind's items, best personal score first.
 */
export function personalizePage(
  items: readonly FeedItem[],
  vector: TasteVector,
  seen: ReadonlySet<string>,
  niche: string | null = null,
): FeedItem[] {
  if (vector.size === 0) return [...items]
  const kept = items.filter((item) => itemAffinity(item, vector, niche).score > HIDE_BELOW)
  const byKind = new Map<string, FeedItem[]>()
  for (const item of kept) {
    const kind = mixKind(item)
    byKind.set(kind, [...(byKind.get(kind) ?? []), item])
  }
  const sorted = new Map(
    [...byKind].map(([kind, list]) => [
      kind,
      list
        .map((item, index) => ({ item, index, score: personalScore(item, vector, seen, niche) }))
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map(({ item }) => item),
    ]),
  )
  const cursor = new Map<string, number>()
  return kept.map((item) => {
    const kind = mixKind(item)
    const next = cursor.get(kind) ?? 0
    cursor.set(kind, next + 1)
    return sorted.get(kind)?.[next] ?? item
  })
}

export interface OrderedNiche {
  slug: string
  /** Why this niche is here: one of your niches, or exploration two hops out. */
  why: "taste" | "explore" | "default"
  /** For exploration: the niche of yours it's two hops from. */
  from?: string
}

/**
 * Page order for the home feed: your niches (by affinity), with about one
 * page in seven drawn from niches two hops from them so taste doesn't
 * collapse into one thing, then today's default order. Disliked niches last.
 */
export function personalNicheOrder(
  base: readonly string[],
  nicheScores: ReadonlyMap<string, number>,
  twoHops: (slug: string) => readonly string[],
): OrderedNiche[] {
  const known = new Set(base)
  const mine = [...nicheScores]
    .filter(([slug, score]) => score > 0 && known.has(slug))
    .sort((a, b) => b[1] - a[1])
    .map(([slug]) => slug)
  if (mine.length === 0) return base.map((slug) => ({ slug, why: "default" }))

  const used = new Set(mine)
  const disliked = (slug: string) => (nicheScores.get(slug) ?? 0) < 0
  const explore: OrderedNiche[] = []
  for (const from of mine) {
    for (const slug of twoHops(from)) {
      if (!known.has(slug) || used.has(slug) || disliked(slug)) continue
      used.add(slug)
      explore.push({ slug, why: "explore", from })
    }
  }
  const out: OrderedNiche[] = []
  const every = Math.round(1 / EXPLORATION_SHARE)
  const queue = [...mine.map((slug): OrderedNiche => ({ slug, why: "taste" }))]
  while (queue.length > 0 || explore.length > 0) {
    if ((out.length + 1) % every === 0 && explore.length > 0) out.push(explore.shift()!)
    else if (queue.length > 0) out.push(queue.shift()!)
    else out.push(explore.shift()!)
  }
  const rest = base.filter((slug) => !used.has(slug))
  return [
    ...out,
    ...rest
      .filter((slug) => !disliked(slug))
      .map((slug): OrderedNiche => ({ slug, why: "default" })),
    ...rest.filter(disliked).map((slug): OrderedNiche => ({ slug, why: "default" })),
  ]
}

const VERB: Partial<Record<Affinity["because"] & string, string>> = {
  play: "played",
  play_through: "played",
  save: "saved",
  like: "liked",
  share: "shared",
  follow: "follow",
  open: "checked out",
  dwell: "lingered on",
}

export interface Reason {
  text: string
  /** About this card's own artist/brand (show on the card) vs its page's niche (show once). */
  specific: boolean
}

/**
 * The card's "because you…" line, or null when it isn't personalized.
 * Only cites signals that really happened.
 */
export function reasonOf(
  item: FeedItem,
  vector: TasteVector,
  niche: string | null = null,
  page?: OrderedNiche,
): Reason | null {
  const { score, via } = itemAffinity(item, vector, niche)
  if (via && score > 0.5 && via.because) {
    const specific = entityType(via.entity) !== "niche"
    if (via.because === "vibe_check")
      return { text: `From your vibe check: ${via.label}`, specific }
    const verb = VERB[via.because]
    if (verb) return { text: `Because you ${verb} ${via.label}`, specific }
  }
  if (page?.why === "explore" && page.from) {
    const from = vector.get(`niche:${page.from}` as EntityRef)?.label ?? page.from
    return { text: `New to you · close to ${from}`, specific: false }
  }
  return null
}

export const reasonFor = (...args: Parameters<typeof reasonOf>): string | null =>
  reasonOf(...args)?.text ?? null

/**
 * Reasons for a page of cards: card-specific ones on every card, the
 * page-level one ("Because you follow jerk") only on the first card that
 * has it, so a page doesn't repeat itself.
 */
export function pageReasons(
  items: readonly FeedItem[],
  vector: TasteVector,
  niche: string | null,
  page?: OrderedNiche,
): (string | null)[] {
  let pageLevelShown = false
  return items.map((item) => {
    const reason = reasonOf(item, vector, niche, page)
    if (!reason) return null
    if (reason.specific) return reason.text
    if (pageLevelShown) return null
    pageLevelShown = true
    return reason.text
  })
}

const SECTION_REASONS = 2

/**
 * One "because you…" line for a whole section of the issue: the strongest
 * real signals behind its items ("Picked because you played Playboi Carti
 * and checked out rage"), or null when nothing in it is personalized.
 */
export function sectionReason(items: readonly FeedItem[], vector: TasteVector): string | null {
  const best = new Map<string, { score: number; phrase: string }>()
  for (const item of items) {
    const niche = typeof item.meta.nicheSlug === "string" ? item.meta.nicheSlug : null
    const { score, via } = itemAffinity(item, vector, niche)
    if (!via?.because || score <= 0.5) continue
    const phrase =
      via.because === "vibe_check"
        ? `matched ${via.label} in your vibe check`
        : VERB[via.because]
          ? `${VERB[via.because]} ${via.label}`
          : null
    if (!phrase) continue
    const prior = best.get(via.entity)
    if (!prior || prior.score < score) best.set(via.entity, { score, phrase })
  }
  const top = [...best.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, SECTION_REASONS)
    .map((r) => r.phrase)
  return top.length > 0 ? `Picked because you ${top.join(" and ")}` : null
}
