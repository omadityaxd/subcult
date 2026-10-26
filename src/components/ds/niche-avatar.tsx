import { CdnImage } from "@/components/ds/cdn-image"
import { coverBackground } from "@/lib/design/cover"
import { cn } from "@/lib/utils"

interface NicheAvatarProps {
  slug: string
  name: string
  palette: readonly string[]
  /** The niche's top artist photo. Without one, the cover + serif monogram stands in. */
  imageUrl?: string | null
  /** Gradient ring = there's something new here (Instagram-style). */
  unseen?: boolean
  size?: "xs" | "sm" | "md" | "lg"
  className?: string
}

const SIZE = {
  xs: "size-8 text-[14px]",
  sm: "size-10 text-[18px]",
  md: "size-16 text-[26px]",
  lg: "size-24 text-[40px]",
}
const PIXELS = { xs: 32, sm: 40, md: 64, lg: 96 }

/** Circular niche mark: the top artist's photo, or its cover plus a serif monogram. No emoji. */
export function NicheAvatar({
  slug,
  name,
  palette,
  imageUrl,
  unseen,
  size = "md",
  className,
}: NicheAvatarProps) {
  const ring = unseen
    ? `conic-gradient(from 200deg, ${palette[2]}, ${palette[3]}, ${palette[1]}, ${palette[2]})`
    : "var(--border-strong)"
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-full p-[2px]", className)}
      style={{ background: ring }}
    >
      <span className="rounded-full bg-background p-[2px]">
        <span
          className={cn(
            "grain relative grid place-items-center overflow-hidden rounded-full font-serif text-white/90 italic",
            SIZE[size],
          )}
          style={coverBackground(palette, slug)}
        >
          <span aria-hidden className="-translate-y-px drop-shadow-sm">
            {name.charAt(0)}
          </span>
          {imageUrl ? (
            // Sits over the monogram, so a slow or failed image still shows the fallback.
            <CdnImage
              src={imageUrl}
              alt=""
              // Display size: next/image adds the 2x candidate. (Doubling it here fetched
              // Spotify's 320px variant, ~28KB, for a 64px ring; 160px is ~8KB.)
              width={PIXELS[size]}
              height={PIXELS[size]}
              // Story rings sit above the cover: they mustn't compete with it for bandwidth.
              fetchPriority="low"
              className="absolute inset-0 size-full object-cover"
            />
          ) : null}
        </span>
      </span>
    </span>
  )
}
