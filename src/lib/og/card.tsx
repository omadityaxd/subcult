import { ImageResponse } from "next/og"
import { isFetchableImageUrl } from "@/lib/images/facts-server"
import { loadOgFonts, ogFonts, paletteBackdrop } from "./brand"

export const OG_SIZE = { width: 1200, height: 630 }

const FALLBACK_PALETTE = ["#0b0a10", "#1d1b2a", "#4b4470", "#c9b8ff", "#f5f2ff"]

/**
 * The standard link-preview card: masthead, a small-caps kicker, a big
 * serif title and one line under it, on the niche's palette; with a photo
 * panel on the right when there's a sharp one to show.
 */
export async function renderBrandCard({
  kicker,
  title,
  subtitle,
  palette = FALLBACK_PALETTE,
  imageUrl = null,
}: {
  kicker: string
  title: string
  subtitle?: string | null
  palette?: readonly string[]
  imageUrl?: string | null
}): Promise<ImageResponse> {
  const fonts = await loadOgFonts()
  const photo = imageUrl && isFetchableImageUrl(imageUrl) ? imageUrl : null
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundImage: paletteBackdrop(palette),
        backgroundColor: palette[0],
        color: "#ffffff",
        fontFamily: "Geist",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          flex: 1,
          padding: 72,
        }}
      >
        <span style={{ fontFamily: "Instrument Serif", fontSize: 48 }}>subcult</span>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{ fontSize: 24, letterSpacing: 5, textTransform: "uppercase", opacity: 0.8 }}
          >
            {kicker}
          </span>
          <span
            style={{
              fontFamily: "Instrument Serif",
              fontSize: title.length > 22 ? 84 : 112,
              lineHeight: 0.95,
              marginTop: 16,
            }}
          >
            {title}
          </span>
          {subtitle ? (
            <span
              style={{ fontSize: 30, marginTop: 24, opacity: 0.88, maxWidth: photo ? 620 : 980 }}
            >
              {subtitle.length > 110 ? `${subtitle.slice(0, 107)}…` : subtitle}
            </span>
          ) : null}
        </div>
      </div>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img>
        <img src={photo} alt="" width={400} height={630} style={{ objectFit: "cover" }} />
      ) : null}
    </div>,
    { ...OG_SIZE, fonts: ogFonts(fonts) },
  )
}
