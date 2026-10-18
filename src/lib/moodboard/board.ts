import { NEAR_COLOR, colorDistance, luminance } from "@/lib/color"
import type { FeedItem } from "@/lib/feed/types"
import { belongsInFeed, isVerifiedFit } from "@/lib/vision/tag"
import type { Pin, PinSource } from "./types"

export const BOARD_MAX = 60

/**
 * Board order: sources round-robin (external boards lead) so one source
 * never floods the grid; duplicates by image URL dropped.
 */
export function assembleBoard(lists: readonly (readonly Pin[])[], max = BOARD_MAX): Pin[] {
  const seen = new Set<string>()
  const out: Pin[] = []
  const longest = Math.max(0, ...lists.map((list) => list.length))
  for (let i = 0; i < longest && out.length < max; i++) {
    for (const list of lists) {
      const pin = list[i]
      if (!pin || seen.has(pin.imageUrl)) continue
      seen.add(pin.imageUrl)
      out.push(pin)
      if (out.length >= max) break
    }
  }
  return out
}

/** Pins whose dominant color is near the swatch, closest first. */
export function pinsNearColor(pins: readonly Pin[], swatch: string, max = NEAR_COLOR): Pin[] {
  return pins
    .flatMap((pin) => {
      if (!pin.color) return []
      const distance = colorDistance(pin.color, swatch)
      return distance <= max ? [{ pin, distance }] : []
    })
    .sort((a, b) => a.distance - b.distance)
    .map(({ pin }) => pin)
}

/** "More like this": same source query/channel first, then nearest color. */
export function similarPins(pins: readonly Pin[], target: Pin, limit = 9): Pin[] {
  const others = pins.filter((pin) => pin.id !== target.id)
  if (!target.color) return others.slice(0, limit)
  const color = target.color
  return [...others]
    .sort(
      (a, b) =>
        (a.color ? colorDistance(a.color, color) : Infinity) -
        (b.color ? colorDistance(b.color, color) : Infinity),
    )
    .slice(0, limit)
}

const FEED_SOURCES: Partial<Record<PinSource, FeedItem["source"]>> = {
  arena: "arena",
  unsplash: "unsplash",
  pexels: "pexels",
  // Artist photos are scene imagery (tap opens the artist); album art and
  // video stills stay on the board, in the feed they'd repeat other cards.
  artist: "subcult",
}

const BLANK_LUMINANCE = 0.002

/** Pins as For You items: the "moodboard" share of the mix. */
export function moodboardFeedItems(pins: readonly Pin[]): FeedItem[] {
  return pins.flatMap((pin) => {
    const source = FEED_SOURCES[pin.source]
    if (!source) return []
    // External images reach a feed only once vision-tagged as on-topic and good enough;
    // untagged ones (no key, over the cap) stay on the moodboard.
    if (pin.source !== "artist" && !belongsInFeed(pin.vision)) return []
    // A solid-black placeholder photo (some Spotify artist images) isn't imagery.
    if (pin.color && luminance(pin.color) < BLANK_LUMINANCE) return []
    return [
      {
        id: `pin:${pin.id}`,
        source,
        type: "pin" as const,
        title: pin.title ?? pin.credit?.label ?? "Moodboard",
        subtitle: pin.credit?.label ?? null,
        imageUrl: pin.imageUrl,
        url: pin.pageUrl,
        publishedAt: null,
        score: 1,
        meta: {
          largeUrl: pin.largeUrl,
          color: pin.color,
          creditUrl: pin.credit?.url ?? null,
          width: pin.width,
          height: pin.height,
          downloadLocation: pin.downloadLocation ?? null,
          artistSlug: pin.source === "artist" ? pin.id.replace(/^artist:/, "") : null,
          fit: isVerifiedFit(pin.vision),
          // An artist photo tagged as an outfit: "seen on <artist>".
          seenOn: pin.source === "artist" && isVerifiedFit(pin.vision) ? (pin.title ?? null) : null,
          note: pin.note ?? null,
          wearingSlug: pin.wearing?.slug ?? null,
          wearingName: pin.wearing?.name ?? null,
        },
      },
    ]
  })
}
