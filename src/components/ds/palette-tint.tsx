import type { FeedItem } from "@/lib/feed/types"
import { overlayPalette } from "@/lib/today/tea-image"

/** Fallback photos (tea-image.ts) are tinted with the niche palette so they read as scene art. */
export function PaletteTint({ item }: { item: FeedItem }) {
  const tint = overlayPalette(item)
  if (!tint) return null
  const stops = [...tint, ...tint].slice(0, Math.max(2, tint.length))
  return (
    <span
      aria-hidden
      className="absolute inset-0 opacity-70 mix-blend-multiply"
      style={{ background: `linear-gradient(160deg, ${stops.join(", ")})` }}
    />
  )
}
