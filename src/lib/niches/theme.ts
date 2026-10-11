import type { CSSProperties } from "react"
import { ensureContrast, mixHex, pickAccent, readableTextColor, withAlpha } from "@/lib/color"

/** Must match --background in globals.css for each theme. */
export const PAGE_BACKGROUND = { dark: "#0b0a10", light: "#f2f2f7" } as const

export interface NicheTheme {
  accentDark: string
  accentLight: string
  style: CSSProperties
}

/**
 * Turns a niche palette into CSS custom properties. Accents are chosen per
 * theme for contrast against that theme's background, and their foreground
 * ink is computed, so any generated palette stays accessible.
 */
export function nicheTheme(palette: readonly string[]): NicheTheme {
  const accentDark = pickAccent(palette, PAGE_BACKGROUND.dark)
  const accentLight = pickAccent(palette, PAGE_BACKGROUND.light)
  const [c1, c2, c3, c4, c5] = palette

  const style = {
    "--niche-1": c1,
    "--niche-2": c2,
    "--niche-3": c3,
    "--niche-4": c4,
    "--niche-5": c5,
    "--niche-accent-dark": accentDark,
    "--niche-accent-fg-dark": readableTextColor(accentDark),
    "--niche-accent-light": accentLight,
    "--niche-accent-fg-light": readableTextColor(accentLight),
    "--niche-glow": withAlpha(accentDark, 0.45),
    "--niche-gradient": `linear-gradient(160deg, ${c2} 0%, ${c3} 55%, ${c4} 100%)`,
  } as CSSProperties

  return { accentDark, accentLight, style }
}

/**
 * The niche theme re-centred on one color (a tapped palette swatch, or the
 * playing track's album art): accent, glow and gradient follow it, nudged
 * per theme until it reads as UI.
 */
export function tintTheme(color: string): CSSProperties {
  const accentDark = ensureContrast(color, PAGE_BACKGROUND.dark)
  const accentLight = ensureContrast(color, PAGE_BACKGROUND.light)
  return {
    "--niche-accent-dark": accentDark,
    "--niche-accent-fg-dark": readableTextColor(accentDark),
    "--niche-accent-light": accentLight,
    "--niche-accent-fg-light": readableTextColor(accentLight),
    "--niche-glow": withAlpha(accentDark, 0.45),
    "--niche-gradient": `linear-gradient(160deg, ${mixHex(color, "#000000", 0.55)} 0%, ${color} 55%, ${mixHex(color, "#ffffff", 0.35)} 100%)`,
  } as CSSProperties
}
