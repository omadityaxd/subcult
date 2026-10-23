import type { FactsMap } from "@/lib/images/curate"
import { canonicalImage } from "@/lib/images/variants"

/** The cover's picture when no fit or grail earns it. */
export type CoverArt =
  { kind: "portrait"; imageUrl: string; label: string } | { kind: "mosaic"; images: string[] }

export interface Portrait {
  imageUrl: string
  /** Who it is: the cover credits them. */
  label: string
}

/** A portrait printed full-bleed needs at least this much width (Spotify's are 640). */
export const PORTRAIT_MIN_WIDTH = 600
const MOSAIC_SIZE = 3

/**
 * Never an empty gradient: one of the lead scene's sharp artist portraits
 * (at least PORTRAIT_MIN_WIDTH; `day` rotates among equally good ones, the
 * lead artist first), else a mosaic of three different pictures from the
 * issue, else nothing (the palette cover).
 */
export function chooseCoverArt(
  portraits: readonly Portrait[],
  pictures: readonly string[],
  facts: FactsMap,
  day = 0,
): CoverArt | null {
  const width = (url: string) => facts.get(url)?.width ?? 0
  const widest = Math.max(0, ...portraits.map((p) => width(p.imageUrl)))
  const best = portraits.filter((p) => width(p.imageUrl) === widest)
  const pick = best.length > 0 ? best[day % best.length] : undefined
  if (pick && widest >= PORTRAIT_MIN_WIDTH) {
    return { kind: "portrait", imageUrl: pick.imageUrl, label: pick.label }
  }
  const seen = new Set<string>()
  const images: string[] = []
  for (const url of [...portraits.map((p) => p.imageUrl), ...pictures]) {
    const key = canonicalImage(url)
    if (seen.has(key)) continue
    seen.add(key)
    images.push(url)
    if (images.length === MOSAIC_SIZE) return { kind: "mosaic", images }
  }
  return null
}
