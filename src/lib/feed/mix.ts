import type { FeedItem } from "./types"

/**
 * The For You content mix. Every page of the feed is built to hit target
 * shares per content kind, instead of "whatever the fetchers returned".
 */
export const MIX_KINDS = ["music", "pin", "shop", "video", "news", "artists", "discovery"] as const
export type MixKind = (typeof MIX_KINDS)[number]
export type MixShares = Record<MixKind, number>

export const DEFAULT_MIX: MixShares = {
  music: 0.3,
  pin: 0.15,
  shop: 0.15,
  video: 0.1,
  news: 0.1,
  artists: 0.1,
  discovery: 0.1,
}

/** Branch overrides: fashion leans on shop + moodboard, music niches on music. */
export const BRANCH_MIX: Readonly<Record<string, Partial<MixShares>>> = {
  "underground-fashion": { music: 0.15, pin: 0.22, shop: 0.23 },
  "underground-music": { music: 0.4, pin: 0.1, shop: 0.1 },
  "underground-internet": { music: 0.4, pin: 0.1, shop: 0.1 },
  "alt-metal-revival": { music: 0.4, pin: 0.1, shop: 0.1 },
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
 * Hard ceilings that redistribution can never push a kind past (video is
 * capped at 10% of the feed however much share other sources leave free).
 */
export const MIX_CAPS: Readonly<Partial<MixShares>> = { video: 0.1 }

/** Which bucket an item counts toward. */
export function mixKind(item: Pick<FeedItem, "source" | "type" | "meta">): MixKind {
  // Songs and playlists are music wherever they come from (Spotify or our soundtrack).
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
      return item.meta.fit === true ? "artists" : "pin"
    case "ebay":
      return "shop"
    case "subcult":
      return item.type === "artist" ? "artists" : "discovery"
  }
}

export const MAX_RUN = 2

/**
 * Weighted interleave: at each slot, pick the kind furthest behind its target
 * share (largest deficit), never a third of the same kind in a row. Kinds
 * with nothing left drop out and their share is spread over the rest, so a
 * thin source is never padded with junk. Within a kind, input order (rank)
 * is kept.
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

  while (out.length < limit) {
    const slot = out.length + 1
    const underCap = (kind: MixKind) =>
      caps[kind] === undefined ||
      (placed.get(kind) ?? 0) + 1 <= Math.max(1, slot * (caps[kind] ?? 1))
    const live = MIX_KINDS.filter(
      (kind) => (queues.get(kind)?.length ?? 0) > 0 && shares[kind] > 0 && underCap(kind),
    )
    if (live.length === 0) break
    const liveTotal = live.reduce((sum, kind) => sum + shares[kind], 0)
    const recent = kinds.slice(-MAX_RUN)
    const blocked =
      recent.length === MAX_RUN && recent.every((kind) => kind === recent[0]) ? recent[0] : null
    const deficit = (kind: MixKind) => (shares[kind] / liveTotal) * slot - (placed.get(kind) ?? 0)
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
