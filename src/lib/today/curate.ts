import { type FactsMap, dedupeImages, withImageFacts } from "@/lib/images/curate"
import type { FeedItem } from "@/lib/feed/types"
import type { Candidates } from "./edition"

/** Lists that carry pictures, in the order they claim one (the cover comes from the first). */
const ORDER = ["fits", "archive", "digest", "headlines", "drops", "soundPicks", "more"] as const

/**
 * One issue never shows the same picture twice: across every section, a
 * repeat (same image at another size, or a near-identical copy) is dropped.
 * A Tea story whose borrowed photo repeats keeps its place on its palette
 * instead (a story isn't dropped for its stand-in picture). Every kept
 * image carries its subject's position for cropping.
 */
export function curateCandidates(candidates: Candidates, facts: FactsMap): Candidates {
  const seen = { keys: new Set<string>(), hashes: [] as string[] }
  const decided = new Map<string, FeedItem | null>()
  const curate = (item: FeedItem): FeedItem | null => {
    // The digest is a subset of the headlines: one decision per item.
    if (decided.has(item.id)) return decided.get(item.id) ?? null
    const kept = dedupeImages([item], (i) => i.imageUrl, facts, seen).length > 0
    const out = kept
      ? withImageFacts(item, facts)
      : item.meta.imageFallback === true
        ? { ...item, imageUrl: null }
        : null
    decided.set(item.id, out)
    return out
  }
  const out = { ...candidates }
  for (const list of ORDER) {
    out[list] = candidates[list].flatMap((item) => curate(item) ?? [])
  }
  return out
}
