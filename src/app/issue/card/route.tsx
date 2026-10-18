import { ImageResponse } from "next/og"
import { z } from "zod"
import { getDb } from "@/db"
import { getProfile } from "@/db/fit-repository"
import { env } from "@/lib/env"
import { loadOgFonts, ogFonts, paletteBackdrop } from "@/lib/og/brand"
import { clientIp } from "@/lib/request"
import { getLimiter } from "@/lib/rate-limit"
import { getViewer } from "@/lib/supabase/server"
import { formatIssueNo } from "@/lib/today/issues"

const HEX = /^#[0-9a-fA-F]{6}$/
const FALLBACK = ["#0b0a10", "#1d1b2a", "#4b4470", "#c9b8ff", "#f5f2ff"]

/**
 * Image hosts the card may fetch (the server downloads the cover image to
 * draw it). Anything else falls back to the palette: never fetch arbitrary
 * URLs on a caller's behalf.
 */
function allowedImage(raw: string | undefined): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw)
    const host = url.hostname
    const supabase = env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null
    const ok =
      url.protocol === "https:" &&
      (host === "i.scdn.co" ||
        host.endsWith(".mzstatic.com") ||
        host.endsWith(".ebayimg.com") ||
        host === "images.unsplash.com" ||
        host === "images.pexels.com" ||
        host === "image-cdn.hypb.st" ||
        host === "d2w9rnfcy7mm78.cloudfront.net" ||
        host === supabase)
    return ok ? url.toString() : null
  } catch {
    return null
  }
}

const querySchema = z.object({
  no: z.coerce.number().int().min(1).max(100_000),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  headline: z.string().min(1).max(140),
  lines: z.string().max(600).optional(),
  img: z.string().max(1000).optional(),
  palette: z.string().max(80).optional(),
})

/** GET /issue/card?no&day&headline&lines&img&palette → the issue cover as a 1080×1920 PNG. */
export async function GET(request: Request): Promise<Response> {
  const limit = await getLimiter("issue-card", 20, "10 m").limit(clientIp(request.headers))
  if (!limit.success) return new Response("slow down a little", { status: 429 })
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return new Response("bad issue", { status: 400 })
  const { no, day, headline, img } = parsed.data
  const lines = (parsed.data.lines ?? "").split("\n").filter(Boolean).slice(0, 3)
  const palette = (parsed.data.palette ?? "").split(",").filter((c) => HEX.test(c))
  const colors = palette.length >= 4 ? palette : FALLBACK
  const image = allowedImage(img)

  // The masthead carries the reader's handle when they have one (never their email).
  const viewer = await getViewer().catch(() => null)
  const db = getDb()
  const handle = viewer && db ? ((await getProfile(db, viewer.id))?.handle ?? null) : null
  const fonts = await loadOgFonts()
  const date = new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  })

  const card = new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundImage: image ? undefined : paletteBackdrop(colors),
        backgroundColor: colors[0],
        color: "#ffffff",
        fontFamily: "Geist",
      }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori draws plain <img>
        <img
          src={image}
          alt=""
          width={1080}
          height={1920}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          backgroundImage:
            "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.8) 100%)",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          padding: 96,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontFamily: "Instrument Serif", fontSize: 120, lineHeight: 1 }}>
              subcult
            </span>
            {handle ? (
              <span
                style={{ fontSize: 34, opacity: 0.85, marginTop: 8 }}
              >{`@${handle}'s issue`}</span>
            ) : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ fontSize: 36, letterSpacing: 8 }}>{`NO. ${formatIssueNo(no)}`}</span>
            <span style={{ fontSize: 30, opacity: 0.8, marginTop: 6 }}>{date}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Instrument Serif",
              fontSize: 132,
              lineHeight: 0.95,
              letterSpacing: -2,
            }}
          >
            {headline}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 48, gap: 18 }}>
            {lines.map((line) => (
              <div key={line} style={{ display: "flex", fontSize: 40, opacity: 0.92 }}>
                {`— ${line}`}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    { width: 1080, height: 1920, fonts: ogFonts(fonts) },
  )
  card.headers.set("Cache-Control", "private, no-store")
  return card
}
