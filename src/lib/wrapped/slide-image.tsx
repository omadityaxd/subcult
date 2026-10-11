import { ImageResponse } from "next/og"
import { loadOgFonts, ogFonts, paletteBackdrop } from "@/lib/og/brand"
import type { SlideCopy } from "./copy"

export const SLIDE_SIZE = { width: 1080, height: 1920 }

/** A Wrapped slide as a 1080×1920 story image (same words as the in-app slide). */
export async function renderSlideImage(
  copy: SlideCopy,
  palette: readonly string[],
): Promise<ImageResponse> {
  const fonts = await loadOgFonts()
  const accent = palette[3] ?? "#ffffff"
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "120px 88px",
        backgroundImage: paletteBackdrop(palette),
        backgroundColor: palette[0],
        color: "#ffffff",
        fontFamily: "Geist",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 34, opacity: 0.8 }}>
        <span style={{ fontFamily: "Instrument Serif", fontSize: 56 }}>subcult</span>
        <span style={{ letterSpacing: 6, textTransform: "uppercase" }}>wrapped</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: 40, letterSpacing: 5, textTransform: "uppercase", opacity: 0.75 }}>
          {copy.overline}
        </span>
        <span
          style={{
            marginTop: 28,
            fontFamily: "Instrument Serif",
            fontSize: copy.headline.length > 18 ? 132 : 176,
            lineHeight: 0.95,
            letterSpacing: -3,
          }}
        >
          {copy.headline}
        </span>
        {copy.caption ? (
          <span style={{ marginTop: 36, fontSize: 46, lineHeight: 1.3, opacity: 0.85 }}>
            {copy.caption}
          </span>
        ) : null}

        {copy.rows ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 34, marginTop: 72 }}>
            {copy.rows.map((row, index) => (
              <div
                key={`${row.label}-${index}`}
                style={{ display: "flex", alignItems: "center", gap: 32 }}
              >
                <span style={{ width: 52, fontSize: 44, opacity: 0.6 }}>{index + 1}</span>
                {row.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img>
                  <img
                    src={row.imageUrl}
                    alt=""
                    width={112}
                    height={112}
                    style={{ borderRadius: 20, objectFit: "cover" }}
                  />
                ) : null}
                <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                  <span style={{ fontFamily: "Instrument Serif", fontSize: 64, lineHeight: 1 }}>
                    {row.label.length > 26 ? `${row.label.slice(0, 25)}…` : row.label}
                  </span>
                  {row.detail ? (
                    <span style={{ marginTop: 8, fontSize: 34, opacity: 0.7 }}>{row.detail}</span>
                  ) : null}
                  {row.percent !== undefined ? (
                    <div
                      style={{
                        display: "flex",
                        marginTop: 16,
                        height: 14,
                        borderRadius: 999,
                        backgroundColor: "rgba(255,255,255,0.18)",
                      }}
                    >
                      <div
                        style={{
                          width: `${row.percent}%`,
                          borderRadius: 999,
                          backgroundColor: accent,
                        }}
                      />
                    </div>
                  ) : null}
                </div>
                {row.percent !== undefined ? (
                  <span style={{ fontSize: 52 }}>{`${row.percent}%`}</span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <span style={{ display: "flex", fontSize: 36, opacity: 0.7 }}>
        What&apos;s your niche, actually?
      </span>
    </div>,
    { ...SLIDE_SIZE, fonts: ogFonts(fonts) },
  )
}
