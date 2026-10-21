import { OG_SIZE, renderBrandCard } from "@/lib/og/card"

export const alt = "subcult: your daily subculture issue"
export const size = OG_SIZE
export const contentType = "image/png"

/** The site's link preview (home: today's issue). */
export default async function Image() {
  return renderBrandCard({
    kicker: "A new issue every day",
    title: "Your daily subculture issue",
    subtitle: "The tea, the fits, the grails, the sounds and what's rising in your scenes.",
  })
}
