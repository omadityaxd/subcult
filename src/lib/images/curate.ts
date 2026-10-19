import type { FeedItem } from "@/lib/feed/types"
import { type ImageFacts, isSameImage } from "./facts"
import { type ImageSlot, MIN_WIDTH, canonicalImage, knownWidth } from "./variants"

/** Facts we've analyzed, by image URL (null = tried and failed). */
export type FactsMap = ReadonlyMap<string, ImageFacts | null>

const EMPTY: FactsMap = new Map()

/** The real width: measured when we have it, else what the URL promises. */
export function realWidth(url: string, facts: FactsMap = EMPTY): number | null {
  return facts.get(url)?.width ?? knownWidth(url)
}

/** Whether an image is sharp enough for a slot. Unknown width never qualifies for hero/cover. */
export function fitsSlot(url: string | null, slot: ImageSlot, facts: FactsMap = EMPTY): boolean {
  if (!url) return false
  return (realWidth(url, facts) ?? 0) >= MIN_WIDTH[slot]
}

/**
 * Keeps the first of every picture: the same image at another size (same
 * canonical key) or a near-identical one (dHash within distance) is dropped.
 * Things without an image always stay.
 */
export function dedupeImages<T>(
  items: readonly T[],
  imageOf: (item: T) => string | null,
  facts: FactsMap = EMPTY,
  seen: { keys: Set<string>; hashes: string[] } = { keys: new Set(), hashes: [] },
): T[] {
  return items.filter((item) => {
    const url = imageOf(item)
    if (!url) return true
    const key = canonicalImage(url)
    const hash = facts.get(url)?.hash ?? null
    if (seen.keys.has(key)) return false
    if (hash && seen.hashes.some((other) => isSameImage(hash, other))) return false
    seen.keys.add(key)
    if (hash) seen.hashes.push(hash)
    return true
  })
}

/** Feed items carry their subject's position (meta.focusX/Y) so every crop keeps it in frame. */
export function withImageFacts(item: FeedItem, facts: FactsMap): FeedItem {
  const found = item.imageUrl ? facts.get(item.imageUrl) : null
  if (!found) return item
  return {
    ...item,
    meta: {
      ...item.meta,
      imgW: found.width,
      imgH: found.height,
      focusX: Math.round(found.focusX * 100) / 100,
      focusY: Math.round(found.focusY * 100) / 100,
    },
  }
}

/** CSS object-position from a located subject. */
export function focusCss(
  focus: { focusX: number; focusY: number } | null | undefined,
): string | undefined {
  return focus ? `${Math.round(focus.focusX * 100)}% ${Math.round(focus.focusY * 100)}%` : undefined
}

/** CSS object-position for an item's image, when its subject has been located. */
export function focusOf(item: Pick<FeedItem, "meta">): string | undefined {
  const { focusX, focusY } = item.meta
  return typeof focusX === "number" && typeof focusY === "number"
    ? focusCss({ focusX, focusY })
    : undefined
}
