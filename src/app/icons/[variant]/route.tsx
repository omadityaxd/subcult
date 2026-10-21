import { ImageResponse } from "next/og"

/**
 * App icons rendered from code (no binary assets to keep in sync).
 * `glyph` is the mark's share of the canvas; maskable icons keep it inside
 * the 80% safe zone Android crops to.
 */
const VARIANTS = {
  "32": { size: 32, glyph: 0.7 },
  "192": { size: 192, glyph: 0.62 },
  "512": { size: 512, glyph: 0.62 },
  "maskable-512": { size: 512, glyph: 0.46 },
  "apple-180": { size: 180, glyph: 0.62 },
} as const

type Variant = keyof typeof VARIANTS

const isVariant = (value: string): value is Variant => value in VARIANTS

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((variant) => ({ variant }))
}

export async function GET(_request: Request, { params }: RouteContext<"/icons/[variant]">) {
  const { variant } = await params
  if (!isVariant(variant)) return new Response("Not found", { status: 404 })

  const { size, glyph } = VARIANTS[variant]
  const fontSize = Math.round(size * glyph)
  const dot = Math.round(size * 0.12)

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #8b5cf6 0%, #ff2e88 60%, #ff9f1c 100%)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-end" }}>
        <span
          style={{
            fontSize,
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: 1,
            letterSpacing: -fontSize * 0.04,
            marginBottom: fontSize * 0.08,
          }}
        >
          s
        </span>
        <div
          style={{
            width: dot,
            height: dot,
            borderRadius: dot,
            background: "#c6ff3d",
            marginLeft: dot * 0.25,
            marginBottom: fontSize * 0.2,
          }}
        />
      </div>
    </div>,
    { width: size, height: size },
  )
}
