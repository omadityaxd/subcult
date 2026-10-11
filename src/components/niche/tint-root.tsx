"use client"

import { type CSSProperties, type ReactNode, useEffect, useMemo } from "react"
import { enterNiche, useNicheUi } from "@/lib/niches/niche-ui-store"
import { tintTheme } from "@/lib/niches/theme"

/**
 * The niche page's themed root. The palette's CSS variables come from the
 * server; a picked swatch overrides accent, glow and gradient live.
 */
export function TintRoot({
  slug,
  baseStyle,
  source,
  children,
}: {
  slug: string
  baseStyle: CSSProperties
  source: string
  children: ReactNode
}) {
  const { slug: current, swatch } = useNicheUi()
  useEffect(() => enterNiche(slug), [slug])
  const active = current === slug ? swatch : null
  const style = useMemo(
    () => (active ? { ...baseStyle, ...tintTheme(active) } : baseStyle),
    [active, baseStyle],
  )
  return (
    <div data-niche="" data-niche-source={source} style={style}>
      {children}
    </div>
  )
}
