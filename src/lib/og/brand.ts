import { readFile } from "node:fs/promises"
import { join } from "node:path"

/** Fonts for generated images (OG cards, Wrapped exports). OFL, bundled in src/assets/fonts. */
const FONT_DIR = join(process.cwd(), "src", "assets", "fonts")

export interface OgFonts {
  serif: Buffer
  sans: Buffer
}

let fonts: Promise<OgFonts> | null = null

export function loadOgFonts(): Promise<OgFonts> {
  fonts ??= Promise.all([
    readFile(join(FONT_DIR, "InstrumentSerif-Italic.ttf")),
    readFile(join(FONT_DIR, "Geist-Medium.ttf")),
  ]).then(([serif, sans]) => ({ serif, sans }))
  return fonts
}

export function ogFonts({ serif, sans }: OgFonts) {
  return [
    { name: "Instrument Serif", data: serif, style: "italic" as const, weight: 400 as const },
    { name: "Geist", data: sans, style: "normal" as const, weight: 500 as const },
  ]
}

/** Mesh-ish gradient from a niche palette (Satori supports layered radial gradients). */
export function paletteBackdrop(palette: readonly string[]): string {
  const [ink, deep, mid, bright] = palette
  return [
    `radial-gradient(circle at 18% 22%, ${bright}cc 0%, transparent 45%)`,
    `radial-gradient(circle at 85% 30%, ${mid}cc 0%, transparent 50%)`,
    `radial-gradient(circle at 60% 90%, ${deep} 0%, transparent 60%)`,
    `linear-gradient(160deg, ${deep} 0%, ${ink} 100%)`,
  ].join(", ")
}
