import { mixKind } from "./mix"
import type { FeedItem } from "./types"

/** For You's top chips. "All" shows everything; the rest narrow the masonry. */
export const FEED_FILTERS = [
  { id: "all", label: "All" },
  { id: "fits", label: "Fits" },
  { id: "archive", label: "Archive" },
  { id: "brands", label: "Brands" },
  { id: "sounds", label: "Sounds" },
  { id: "scenes", label: "Scenes" },
] as const

export type FeedFilter = (typeof FEED_FILTERS)[number]["id"]

/** Which chip an item belongs to (besides "All"). */
export function filterOf(item: FeedItem): Exclude<FeedFilter, "all"> {
  if (item.source === "ebay") return "archive"
  if (item.type === "brand") return "brands"
  // Fits means outfits: posted fits and images vision-verified as one. Everything
  // else visual (stock, Are.na, artist photos) is scene imagery.
  if (item.type === "fit" || item.meta.fit === true) return "fits"
  if (mixKind(item) === "music") return "sounds"
  return "scenes"
}

export function applyFilter(items: readonly FeedItem[], filter: FeedFilter): FeedItem[] {
  return filter === "all" ? [...items] : items.filter((item) => filterOf(item) === filter)
}
