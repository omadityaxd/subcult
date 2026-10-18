import type { FeedItem } from "@/lib/feed/types"

export interface TeaFallback {
  /** The story's entity photo (the niche's lead artist), when one exists. */
  imageUrl: string | null
  palette: readonly string[] | null
}

/**
 * A Tea story never runs text-only in the issue: one without its own image
 * borrows the entity photo, marked so the card tints it with the niche
 * palette (it reads as a scene photo, not as a photo of the story).
 */
export function withTeaImage(item: FeedItem, fallback: TeaFallback): FeedItem {
  if (item.imageUrl || !fallback.imageUrl) return item
  return {
    ...item,
    imageUrl: fallback.imageUrl,
    meta: {
      ...item.meta,
      imageFallback: true,
      overlay: fallback.palette && fallback.palette.length > 0 ? fallback.palette.join(",") : null,
    },
  }
}

/**
 * The story's entity photo: an artist the headline names, else the niche's
 * pictured artists in turn (so two stories don't share a face).
 */
export function entityPhoto(
  title: string,
  pictured: readonly { name: string; imageUrl: string | null }[],
  index: number,
): string | null {
  const lower = title.toLowerCase()
  const named = pictured.find(
    (artist) => artist.name.length > 2 && lower.includes(artist.name.toLowerCase()),
  )
  if (named?.imageUrl) return named.imageUrl
  return pictured.length > 0 ? (pictured[index % pictured.length]?.imageUrl ?? null) : null
}

/** The palette a fallback image is tinted with, or null for a story's own image. */
export function overlayPalette(item: FeedItem): string[] | null {
  if (item.meta.imageFallback !== true || typeof item.meta.overlay !== "string") return null
  const colors = item.meta.overlay.split(",").filter((c) => /^#[0-9a-f]{3,8}$/i.test(c))
  return colors.length > 0 ? colors : null
}
