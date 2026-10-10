import { ImageResponse } from "next/og"
import { describeMix, isCuratedNiche } from "@/lib/vibe/data"
import { decodeMix } from "@/lib/vibe/score"
import { renderVibeCard } from "@/lib/vibe/share-card"

export const alt = "A subcult vibe check result"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image({ params }: { params: Promise<{ mix: string }> }) {
  const { mix } = await params
  const decoded = decodeMix(mix, isCuratedNiche)
  if (!decoded) {
    return new ImageResponse(
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#0a0a0a" }} />,
      size,
    )
  }
  return renderVibeCard(describeMix(decoded), size)
}
