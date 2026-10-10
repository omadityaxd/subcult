import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"
import type { MixNiche } from "./data"

const FONT_DIR = join(process.cwd(), "src", "assets", "fonts")

let fonts: Promise<{ serif: Buffer; sans: Buffer }> | null = null
function loadFonts() {
  fonts ??= Promise.all([
    readFile(join(FONT_DIR, "InstrumentSerif-Italic.ttf")),
    readFile(join(FONT_DIR, "Geist-Medium.ttf")),
  ]).then(([serif, sans]) => ({ serif, sans }))
  return fonts
}

/** Mesh-ish gradient from a niche palette (Satori supports layered radial gradients). */
function backdrop(palette: readonly string[]): string {
  const [ink, deep, mid, bright] = palette
  return [
    `radial-gradient(circle at 18% 22%, ${bright}cc 0%, transparent 45%)`,
    `radial-gradient(circle at 85% 30%, ${mid}cc 0%, transparent 50%)`,
    `radial-gradient(circle at 60% 90%, ${deep} 0%, transparent 60%)`,
    `linear-gradient(160deg, ${deep} 0%, ${ink} 100%)`,
  ].join(", ")
}

interface ShareCardOptions {
  width: number
  height: number
}

/** The vibe check result as an image: big serif headline + the three niches with bars. */
export async function renderVibeCard(
  mix: readonly MixNiche[],
  { width, height }: ShareCardOptions,
): Promise<ImageResponse> {
  const { serif, sans } = await loadFonts()
  const [top] = mix
  const scale = width / 1200
  const portrait = height > width

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72 * scale,
        backgroundImage: backdrop(top.palette),
        backgroundColor: top.palette[0],
        color: "#ffffff",
        fontFamily: "Geist",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 28 * scale,
          opacity: 0.8,
        }}
      >
        <span style={{ fontFamily: "Instrument Serif", fontSize: 44 * scale }}>subcult</span>
        <span style={{ letterSpacing: 4 * scale, textTransform: "uppercase" }}>vibe check</span>
      </div>

      <div
        style={{ display: "flex", flexDirection: "column", marginTop: portrait ? 0 : 12 * scale }}
      >
        <div
          style={{
            fontFamily: "Instrument Serif",
            fontSize: (portrait ? 150 : 108) * scale,
            lineHeight: 0.95,
            letterSpacing: -2 * scale,
            display: "flex",
            flexWrap: "wrap",
          }}
        >
          {`${top.percent}% ${top.name}`}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: (portrait ? 22 : 12) * scale,
            marginTop: (portrait ? 44 : 24) * scale,
          }}
        >
          {mix.map((niche) => (
            <div
              key={niche.slug}
              style={{ display: "flex", flexDirection: "column", gap: 10 * scale }}
            >
              <div
                style={{ display: "flex", justifyContent: "space-between", fontSize: 34 * scale }}
              >
                <span
                  style={{ fontFamily: "Instrument Serif", fontSize: (portrait ? 46 : 38) * scale }}
                >
                  {niche.name}
                </span>
                <span>{`${niche.percent}%`}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  height: 10 * scale,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.18)",
                }}
              >
                <div
                  style={{
                    width: `${niche.percent}%`,
                    borderRadius: 999,
                    backgroundColor: niche.palette[3] ?? "#ffffff",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", fontSize: 28 * scale, opacity: 0.75 }}>
        What&apos;s your niche, actually?
      </div>
    </div>,
    {
      width,
      height,
      fonts: [
        { name: "Instrument Serif", data: serif, style: "italic", weight: 400 },
        { name: "Geist", data: sans, style: "normal", weight: 500 },
      ],
    },
  )
}
