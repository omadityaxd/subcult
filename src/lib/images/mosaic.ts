import { type FactsMap, dedupeImages, fitsSlot } from "./curate"

export type MosaicKind = "portrait" | "fit" | "product" | "album"

export interface MosaicTile {
  id: string
  kind: MosaicKind
  imageUrl: string
}

export const MOSAIC_SIZE = 6
/** Album covers are the easiest pictures to come by: a mosaic of them reads as a playlist. */
export const MAX_ALBUMS = 2
const ORDER: readonly MosaicKind[] = ["portrait", "fit", "product", "album"]

/**
 * A niche hero mosaic: kinds interleaved (portrait, fit, product, album, …),
 * at most two album covers, card-quality images only, and never the same
 * picture twice. Fewer than three good tiles means no mosaic at all.
 */
export function mosaicPicks(
  tiles: readonly MosaicTile[],
  facts: FactsMap = new Map(),
  size = MOSAIC_SIZE,
): MosaicTile[] {
  const sharp = dedupeImages(
    tiles.filter((tile) => fitsSlot(tile.imageUrl, "card", facts)),
    (tile) => tile.imageUrl,
    facts,
  )
  const queues = new Map(ORDER.map((kind) => [kind, sharp.filter((t) => t.kind === kind)]))
  const out: MosaicTile[] = []
  let albums = 0
  while (out.length < size) {
    let added = false
    for (const kind of ORDER) {
      if (out.length >= size) break
      if (kind === "album" && albums >= MAX_ALBUMS) continue
      const next = queues.get(kind)?.shift()
      if (!next) continue
      out.push(next)
      if (kind === "album") albums += 1
      added = true
    }
    if (!added) break
  }
  return out.length >= 3 ? out : []
}
