import type { VisionTag } from "@/lib/vision/tag"

/** Where a pin came from. External boards first, then the app's own imagery. */
export const PIN_SOURCES = ["arena", "unsplash", "pexels", "album", "artist", "video"] as const
export type PinSource = (typeof PIN_SOURCES)[number]

export interface PinCredit {
  /** "Photo by Jane Doe on Unsplash" style attribution, as each source requires. */
  label: string
  url: string
}

/** One image on the moodboard. Everything here comes from a live API or our own data. */
export interface Pin {
  id: string
  source: PinSource
  /** Grid-size image (~400-600px wide). */
  imageUrl: string
  /** Sheet-size image. */
  largeUrl: string
  width: number | null
  height: number | null
  /** Dominant color (#rrggbb), extracted at ingest; null when it couldn't be read. */
  color: string | null
  title: string | null
  credit: PinCredit | null
  /** The pin's page at its source (secondary "view on …" link). */
  pageUrl: string
  /** Artist photos: why they matter to this niche (the profile's curated line). */
  note?: string | null
  /** Artist photos: a verified brand they're publicly associated with wearing. */
  wearing?: { slug: string; name: string } | null
  /** What the image is (vision tagging); absent until tagged, which keeps external pins out of feeds. */
  vision?: VisionTag | null
  /** Unsplash only: ping this when a pin is saved (their API guidelines). */
  downloadLocation?: string
}

export interface Moodboard {
  slug: string
  pins: Pin[]
  /** Sources that were skipped because their key is missing. */
  disabled: PinSource[]
}

export const PIN_SOURCE_LABEL: Record<PinSource, string> = {
  arena: "Are.na",
  unsplash: "Unsplash",
  pexels: "Pexels",
  album: "Album art",
  artist: "Artist photo",
  video: "Video still",
}
