import type { FeedItem } from "./types"

/**
 * The For You content mix. subcult is culture and fashion first; music is
 * the soundtrack layer. Every page of the feed is built to hit target shares
 * per content kind instead of "whatever the fetchers returned".
 */
export const MIX_KINDS = ["fashion", "moodboard", "music", "video", "news", "discovery"] as const
export type MixKind = (typeof MIX_KINDS)[number]
export type MixShares = Record<MixKind, number>

export const DEFAULT_MIX: MixShares = {
  fashion: 0.35,
  moodboard: 0.2,
  music: 0.2,
  video: 0.1,
  news: 0.1,
  discovery: 0.05,
}

/** Fashion niches lean further into fits and visuals. Music never goes above its cap anywhere. */
export const BRANCH_MIX: Readonly<Record<string, Partial<MixShares>>> = {
  "underground-fashion": { fashion: 0.4, moodboard: 0.25, music: 0.15, video: 0.05 },
}

/** Default ← branch override ← per-niche override, normalized to sum to 1. */
export function resolveMix(
  branch: string | undefined,
  nicheOverride?: Partial<MixShares>,
): MixShares {
  const merged: MixShares = {
    ...DEFAULT_MIX,
    ...(branch ? BRANCH_MIX[branch] : undefined),
    ...nicheOverride,
  }
  const total = MIX_KINDS.reduce((sum, kind) => sum + Math.max(0, merged[kind]), 0)
  return Object.fromEntries(
    MIX_KINDS.map((kind) => [kind, total > 0 ? Math.max(0, merged[kind]) / total : 0]),
  ) as MixShares
}

/**
 * Hard ceilings per window of WINDOW consecutive items: music is the
 * soundtrack (≤20% of any page), video ≤10%; news and discovery are capped
 * so a feed short on visuals ends early instead of being padded.
 * Redistribution never lifts a kind past its cap.
 */
export const MIX_CAPS: Readonly<Partial<MixShares>> = {
  music: 0.2,
  video: 0.1,
  // When no visual source is live, the fallback kinds absorb a little, then the feed ends.
  news: 0.15,
  discovery: 0.1,
}
export const WINDOW = 20

/** A missing source's share goes to these (visual / fashion), never to music. */
export const REDISTRIBUTE_TO: readonly MixKind[] = ["fashion", "moodboard"]

/** Which bucket an item counts toward. */
export function mixKind(item: Pick<FeedItem, "source" | "type" | "meta">): MixKind {
  if (item.type === "track" || item.type === "playlist") return "music"
  switch (item.source) {
    case "spotify":
      return "music"
    case "youtube":
      return "video"
    case "news":
      return "news"
    case "arena":
    case "unsplash":
    case "pexels":
      return item.meta.fit === true ? "fashion" : "moodboard"
    case "ebay":
      return "fashion"
    case "subcult":
      if (item.type === "fit" || item.type === "brand") return "fashion"
      return item.type === "pin" ? "moodboard" : "discovery"
  }
}

export const MAX_RUN = 2

/**
 * Target shares for the kinds still in play: the base shares, plus the
 * share of every missing kind spread over the live visual/fashion kinds
 * (or, if none are left, the other live non-music kinds).
 */
export function liveTargets(shares: MixShares, live: readonly MixKind[]): Map<MixKind, number> {
  const targets = new Map(live.map((kind) => [kind, shares[kind]] as const))
  const freed = MIX_KINDS.filter((kind) => !live.includes(kind)).reduce(
    (sum, kind) => sum + shares[kind],
    0,
  )
  const visual = live.filter((kind) => REDISTRIBUTE_TO.includes(kind) && shares[kind] > 0)
  const recipients = visual.length > 0 ? visual : live.filter((kind) => kind !== "music")
  const weight = recipients.reduce((sum, kind) => sum + shares[kind], 0)
  for (const kind of recipients) {
    const portion = weight > 0 ? shares[kind] / weight : 1 / recipients.length
    targets.set(kind, (targets.get(kind) ?? 0) + freed * portion)
  }
  return targets
}

/**
 * Weighted interleave: at each slot, pick the kind furthest behind its target
 * (largest deficit), never a third of the same kind in a row, never past a
 * cap within the last WINDOW items. Kinds with nothing left drop out and
 * their share moves to the visual kinds; a thin feed ends short rather than
 * being padded with music. Within a kind, input order (rank) is kept.
 */
export function mixFeed(
  buckets: Partial<Record<MixKind, readonly FeedItem[]>>,
  shares: MixShares,
  limit = Infinity,
  caps: Readonly<Partial<MixShares>> = MIX_CAPS,
): FeedItem[] {
  const queues = new Map(MIX_KINDS.map((kind) => [kind, [...(buckets[kind] ?? [])]] as const))
  const placed = new Map<MixKind, number>(MIX_KINDS.map((kind) => [kind, 0]))
  const out: FeedItem[] = []
  const kinds: MixKind[] = []

  const underCap = (kind: MixKind, slot: number) => {
    const cap = caps[kind]
    if (cap === undefined) return true
    const recent = kinds.slice(-(WINDOW - 1)).filter((placedKind) => placedKind === kind).length
    return recent + 1 <= Math.max(1, Math.floor(Math.min(slot, WINDOW) * cap + 1e-9))
  }

  while (out.length < limit) {
    const slot = out.length + 1
    const available = MIX_KINDS.filter(
      (kind) => (queues.get(kind)?.length ?? 0) > 0 && shares[kind] > 0,
    )
    const live = available.filter((kind) => underCap(kind, slot))
    if (live.length === 0) break
    const targets = liveTargets(shares, available)
    const recent = kinds.slice(-MAX_RUN)
    const blocked =
      recent.length === MAX_RUN && recent.every((kind) => kind === recent[0]) ? recent[0] : null
    const deficit = (kind: MixKind) => (targets.get(kind) ?? 0) * slot - (placed.get(kind) ?? 0)
    const ranked = [...live].sort(
      (a, b) => deficit(b) - deficit(a) || shares[b] - shares[a] || a.localeCompare(b),
    )
    // The run rule only gives way when nothing else is left.
    const pick = ranked.find((kind) => kind !== blocked) ?? ranked[0]
    out.push((queues.get(pick) as FeedItem[]).shift() as FeedItem)
    kinds.push(pick)
    placed.set(pick, (placed.get(pick) ?? 0) + 1)
  }
  return out
}

/** Actual share per kind of a built feed (for tests and the quality report). */
export function measureMix(items: readonly FeedItem[]): MixShares {
  const counts = Object.fromEntries(MIX_KINDS.map((kind) => [kind, 0])) as MixShares
  for (const item of items) counts[mixKind(item)] += 1
  return Object.fromEntries(
    MIX_KINDS.map((kind) => [kind, items.length > 0 ? counts[kind] / items.length : 0]),
  ) as MixShares
}

/** Largest share of `kind` in any WINDOW consecutive items (the "any page" check). */
export function maxWindowShare(items: readonly FeedItem[], kind: MixKind): number {
  if (items.length === 0) return 0
  const size = Math.min(WINDOW, items.length)
  let best = 0
  for (let start = 0; start + size <= items.length; start++) {
    const count = items.slice(start, start + size).filter((item) => mixKind(item) === kind).length
    best = Math.max(best, count / size)
  }
  return best
}
