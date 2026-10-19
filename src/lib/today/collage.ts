import type { FeedItem } from "@/lib/feed/types"
import { dedupeImages, focusOf } from "@/lib/images/curate"
import { MIN_WIDTH, knownWidth } from "@/lib/images/variants"

export type CollageTile =
  | {
      kind: "fit" | "portrait"
      imageUrl: string
      focus: string | null
      caption: string
      detail: string | null
    }
  | { kind: "niche"; palette: readonly string[]; seed: string; caption: string; detail: string }

export interface Portrait {
  name: string
  imageUrl: string
  niche: string
}

export const COLLAGE_TILES = 2

/** The real width we know of: measured (meta.imgW) or promised by the URL. */
function widthOf(url: string, meta: FeedItem["meta"] = {}): number {
  return typeof meta.imgW === "number" ? meta.imgW : (knownWidth(url) ?? 0)
}

/**
 * The login collage's tiles: the best card-quality fit and artist portrait
 * from today's content, never a repeat of the cover or each other; when too
 * few qualify, the niches' generative covers fill in. Never an upscaled
 * thumbnail.
 */
export function collageTiles({
  fits,
  portraits,
  coverUrl,
  niches,
}: {
  fits: readonly FeedItem[]
  portraits: readonly Portrait[]
  coverUrl: string | null
  niches: readonly { slug: string; name: string; palette: readonly string[] }[]
}): CollageTile[] {
  const sharp = (url: string | null, meta?: FeedItem["meta"]) =>
    Boolean(url) && widthOf(url ?? "", meta) >= MIN_WIDTH.card
  const candidates: CollageTile[] = [
    ...fits
      .filter((item) => sharp(item.imageUrl, item.meta))
      .slice(0, 1)
      .map((item): CollageTile => ({
        kind: "fit",
        imageUrl: item.imageUrl as string,
        focus: focusOf(item) ?? null,
        caption: "Fit of the day",
        detail: typeof item.meta.nicheName === "string" ? item.meta.nicheName : null,
      })),
    ...portraits
      .filter((p) => sharp(p.imageUrl))
      .map((p): CollageTile => ({
        kind: "portrait",
        imageUrl: p.imageUrl,
        focus: null,
        caption: p.name,
        detail: p.niche,
      })),
  ]
  const seen = { keys: new Set<string>(), hashes: [] as string[] }
  if (coverUrl) dedupeImages([coverUrl], (url) => url, new Map(), seen)
  const pictured = dedupeImages(
    candidates,
    (tile) => ("imageUrl" in tile ? tile.imageUrl : null),
    new Map(),
    seen,
  ).slice(0, COLLAGE_TILES)
  if (pictured.length >= COLLAGE_TILES) return pictured
  const filler = niches.slice(0, COLLAGE_TILES - pictured.length).map((n): CollageTile => ({
    kind: "niche",
    palette: n.palette,
    seed: n.slug,
    caption: "Today's scene",
    detail: n.name,
  }))
  return [...pictured, ...filler]
}
