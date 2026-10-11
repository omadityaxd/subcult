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

/**
 * Chroma in [0, 1]: how "colorful" a palette entry looks. Unlike HSL
 * saturation it doesn't overrate near-white tints (a cream isn't vivid).
 */
export function chroma(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255
}

/** WCAG minimum for UI components and large text. */
export const MIN_UI_CONTRAST = 3

/**
 * The niche's accent for a given page background: the most colorful palette
 * color that still reads as UI against it; failing that, the highest-contrast
 * one. Computed per theme, so dark and light mode can pick different colors.
 */
export function pickAccent(palette: readonly string[], background: string): string {
  if (palette.length === 0) throw new Error("pickAccent needs at least one color")
  const readable = palette.filter((color) => contrastRatio(color, background) >= MIN_UI_CONTRAST)
  if (readable.length > 0) {
    return readable.reduce((best, color) => (chroma(color) > chroma(best) ? color : best))
  }
  return palette.reduce((best, color) =>
    contrastRatio(color, background) > contrastRatio(best, background) ? color : best,
  )
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const part = (value: number) =>
    Math.round(Math.min(255, Math.max(0, value)))
      .toString(16)
      .padStart(2, "0")
  return `#${part(r)}${part(g)}${part(b)}`
}

/** Linear blend in sRGB: t = 0 → a, t = 1 → b. */
export function mixHex(a: string, b: string, t: number): string {
  const x = hexToRgb(a)
  const y = hexToRgb(b)
  return rgbToHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t })
}

/**
 * The same hue, nudged lighter (dark backgrounds) or darker (light ones)
 * until it reads as UI. Lets any picked swatch become an accessible accent.
 */
export function ensureContrast(
  color: string,
  background: string,
  min: number = MIN_UI_CONTRAST,
): string {
  if (contrastRatio(color, background) >= min) return color
  const target = luminance(background) < 0.5 ? "#ffffff" : "#000000"
  for (let t = 0.1; t <= 1; t += 0.1) {
    const candidate = mixHex(color, target, t)
    if (contrastRatio(candidate, background) >= min) return candidate
  }
  return target
}

/**
 * Perceptual-ish distance between two colors ("redmean" weighted RGB):
 * 0 = identical, ~765 = black vs white. Cheap and good enough for "near
 * this swatch" filtering.
 */
export function colorDistance(a: string, b: string): number {
  const x = hexToRgb(a)
  const y = hexToRgb(b)
  const meanRed = (x.r + y.r) / 2
  const dr = x.r - y.r
  const dg = x.g - y.g
  const db = x.b - y.b
  return Math.sqrt(
    (2 + meanRed / 256) * dr * dr + 4 * dg * dg + (2 + (255 - meanRed) / 256) * db * db,
  )
}

/** Below this distance two colors read as "the same family" in filters. */
export const NEAR_COLOR = 150
