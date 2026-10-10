/**
 * Color helpers for palette-driven theming. Every niche ships its own palette,
 * so text colors are computed (never hand-picked) to keep WCAG contrast.
 */

export type Rgb = { r: number; g: number; b: number }

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

export const INK_DARK = "#0b0a10"
export const INK_LIGHT = "#ffffff"

/** WCAG AA threshold for normal-size text. */
export const MIN_TEXT_CONTRAST = 4.5

export function isHexColor(value: string): boolean {
  return HEX_PATTERN.test(value)
}

export function hexToRgb(hex: string): Rgb {
  const match = HEX_PATTERN.exec(hex)
  if (!match) throw new Error(`Invalid hex color: ${hex}`)
  const digits = match[1]
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((d) => d + d)
          .join("")
      : digits
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

function channelToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Relative luminance per WCAG 2.x. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b)
}

export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Picks whichever ink (near-black or white) reads best on `background`. */
export function readableTextColor(background: string): string {
  return contrastRatio(background, INK_DARK) >= contrastRatio(background, INK_LIGHT)
    ? INK_DARK
    : INK_LIGHT
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex)
  const clamped = Math.min(1, Math.max(0, alpha))
  return `rgb(${r} ${g} ${b} / ${clamped})`
}
