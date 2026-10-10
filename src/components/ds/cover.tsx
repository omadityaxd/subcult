import type { CSSProperties, ReactNode } from "react"
import { coverBackground } from "@/lib/design/cover"
import { cn } from "@/lib/utils"

interface CoverProps {
  palette: readonly string[]
  /** Usually the niche slug: same seed → same cover everywhere. */
  seed: string
  className?: string
  /** Shared-element name so a card cover can morph into the page hero. */
  transitionName?: string
  children?: ReactNode
}

/** Generative niche cover: palette mesh gradient + film grain. Server-safe, zero requests. */
export function Cover({ palette, seed, className, transitionName, children }: CoverProps) {
  const style: CSSProperties = {
    ...coverBackground(palette, seed),
    ...(transitionName ? { viewTransitionName: transitionName } : {}),
  }
  return (
    <div
      aria-hidden={children ? undefined : true}
      className={cn("grain overflow-hidden", className)}
      style={style}
    >
      {children}
    </div>
  )
}
