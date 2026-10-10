import { coverBackground } from "@/lib/design/cover"
import { cn } from "@/lib/utils"

interface NicheAvatarProps {
  slug: string
  name: string
  palette: readonly string[]
  /** Gradient ring = there's something new here (Instagram-style). */
  unseen?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}

const SIZE = { sm: "size-10 text-[18px]", md: "size-16 text-[26px]", lg: "size-24 text-[40px]" }

/** Circular niche mark: its cover plus a serif monogram. No emoji. */
export function NicheAvatar({
  slug,
  name,
  palette,
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
            "grain grid place-items-center rounded-full font-serif text-white/90 italic",
            SIZE[size],
          )}
          style={coverBackground(palette, slug)}
        >
          <span aria-hidden className="-translate-y-px drop-shadow-sm">
            {name.charAt(0)}
          </span>
        </span>
      </span>
    </span>
  )
}
