import { ImageResponse } from "next/og"
import { loadOgFonts, ogFonts, paletteBackdrop } from "@/lib/og/brand"
import type { MixNiche } from "./data"

interface ShareCardOptions {
  width: number
  height: number
}

/** The vibe check result as an image: big serif headline + the three niches with bars. */
export async function renderVibeCard(
  mix: readonly MixNiche[],
  { width, height }: ShareCardOptions,
): Promise<ImageResponse> {
  const fonts = await loadOgFonts()
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
        backgroundImage: paletteBackdrop(top.palette),
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
      fonts: ogFonts(fonts),
    },
  )
}
