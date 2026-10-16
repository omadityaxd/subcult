import { ImageResponse } from "next/og"
import { findPreset } from "@/lib/niches/catalog"
import { loadOgFonts, ogFonts, paletteBackdrop } from "@/lib/og/brand"
import { entitySlug } from "@/lib/taste/entities"
import type { VibeMatch } from "./match"

const FALLBACK_PALETTE = ["#0b0a10", "#1d1b2a", "#4b4470", "#c9b8ff", "#f5f2ff"]

/**
 * The shareable Vibe Match: 1080×1920 story card with both handles, the
 * percent, and what they share. Colors come from their top shared niche.
 */
export async function renderMatchCard(
  me: string,
  them: string,
  match: VibeMatch,
): Promise<ImageResponse> {
  const fonts = await loadOgFonts()
  const top = match.sharedNiches[0]
  const palette = (top && findPreset(entitySlug(top.ref))?.palette) || FALLBACK_PALETTE
  const shared = [...match.sharedNiches, ...match.sharedArtists, ...match.sharedBrands].slice(0, 5)
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 96,
        backgroundImage: paletteBackdrop(palette),
        backgroundColor: palette[0],
        color: "#ffffff",
        fontFamily: "Geist",
      }}
    >
      <div
        style={{ display: "flex", justifyContent: "space-between", fontSize: 34, opacity: 0.85 }}
      >
        <span style={{ fontFamily: "Instrument Serif", fontSize: 56 }}>subcult</span>
        <span style={{ letterSpacing: 6, textTransform: "uppercase" }}>vibe match</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 44, opacity: 0.85 }}>{`@${me} × @${them}`}</div>
        <div
          style={{
            display: "flex",
            fontFamily: "Instrument Serif",
            fontSize: 300,
            lineHeight: 0.9,
            letterSpacing: -6,
            marginTop: 24,
          }}
        >
          {`${match.percent}%`}
        </div>
        {shared.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 72, gap: 20 }}>
            <div style={{ display: "flex", fontSize: 30, letterSpacing: 5, opacity: 0.7 }}>
              YOU BOTH LOVE
            </div>
            {shared.map((entity) => (
              <div
                key={entity.ref}
                style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: 64 }}
              >
                {entity.label}
              </div>
            ))}
          </div>
        ) : null}
        {match.putYouOn ? (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 64, gap: 12 }}>
            <div style={{ display: "flex", fontSize: 30, letterSpacing: 5, opacity: 0.7 }}>
              {`@${them}  WOULD PUT YOU ON`}
            </div>
            <div style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: 64 }}>
              {match.putYouOn.label}
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", fontSize: 32, opacity: 0.75 }}>Find your match on subcult</div>
    </div>,
    { width: 1080, height: 1920, fonts: ogFonts(fonts) },
  )
}
