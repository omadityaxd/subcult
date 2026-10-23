import { type FactsMap, dedupeImages, withImageFacts } from "@/lib/images/curate"
import type { FeedItem } from "@/lib/feed/types"
import { youtubeIdOf } from "@/lib/video/youtube-id"
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
  const seen = { keys: new Set<string>(), hashes: [] as string[], videoHashes: [] as string[] }
  const sources = new Set<string>()
  const decided = new Map<string, FeedItem | null>()
  const curate = (item: FeedItem): FeedItem | null => {
    // The digest is a subset of the headlines: one decision per item.
    if (decided.has(item.id)) return decided.get(item.id) ?? null
    // The same video (or page) under another id: a repeat, whatever its picture.
    const source = sourceKey(item)
    if (source && sources.has(source)) {
      decided.set(item.id, null)
      return null
    }
    if (source) sources.add(source)
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

/** What an item is a copy of: a YouTube video by id, anything else by its URL. */
function sourceKey(item: FeedItem): string | null {
  const video = youtubeIdOf(item)
  if (video) return `youtube:${video}`
  // The query stays: on many sites it's what tells two pages apart.
  return item.url ? item.url.replace(/#.*$/, "").replace(/\/$/, "") : null
}
