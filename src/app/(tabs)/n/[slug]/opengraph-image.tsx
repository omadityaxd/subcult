import { findPreset, findSeedProfile, nicheImage } from "@/lib/niches/catalog"
import { OG_SIZE, renderBrandCard } from "@/lib/og/card"

export const alt = "A subcult niche"
export const size = OG_SIZE
export const contentType = "image/png"

/** A niche's link preview: "the <niche> issue", its tagline, palette and face. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const profile = findSeedProfile(slug)
  const preset = findPreset(slug)
  return renderBrandCard({
    kicker: profile ? `The ${profile.name} issue` : "subcult",
    title: profile?.name ?? "subcult",
    subtitle: profile?.tagline ?? "Your daily subculture issue.",
    palette: preset?.palette,
    imageUrl: profile ? nicheImage(slug) : null,
  })
}
