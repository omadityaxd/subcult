import { handleSchema } from "@/lib/fits/schema"
import { OG_SIZE, renderBrandCard } from "@/lib/og/card"

export const alt = "A subcult vibe match"
export const size = OG_SIZE
export const contentType = "image/png"

/**
 * A vibe match link's preview. Public, so it shows only what any visitor
 * could see (the handle): the score itself is between the two people.
 */
export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const valid = handleSchema.safeParse(handle).success
  return renderBrandCard({
    kicker: "Vibe match",
    title: valid ? `How close is your taste to @${handle}?` : "Vibe match",
    subtitle: "Take the vibe check and see what you share.",
  })
}
