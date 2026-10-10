import { X } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Screen } from "@/components/shell/screen"
import { type NicheInfo, VibeCheckFlow } from "@/components/vibe/vibe-check-flow"
import { TAXONOMY, findPreset } from "@/lib/niches/catalog"
import { VIBE_BLURBS, deckCards } from "@/lib/vibe/data"

export const metadata: Metadata = {
  title: "Vibe check",
  description: "12 swipes, one brutally accurate niche mix.",
}

/** Full-screen flow (no tab bar): the swipe deck, then the result. */
export default function VibeCheckPage() {
  const cards = deckCards()
  const reachable = new Set(cards.flatMap((card) => Object.keys(card.weights)))
  const niches: Record<string, NicheInfo> = Object.fromEntries(
    [...reachable].flatMap((slug) => {
      const preset = findPreset(slug)
      return preset
        ? [
            [
              slug,
              {
                name: preset.name,
                tagline: preset.tagline,
                palette: preset.palette,
                imageUrl: preset.imageUrl,
                branch: TAXONOMY.branchOf(slug),
              },
            ],
          ]
        : []
    }),
  )

  return (
    <Screen withTabBar={false} className="flex h-dvh flex-col">
      <header className="flex h-(--nav-bar-height) shrink-0 items-center justify-between px-4 pt-safe">
        <p className="font-serif text-title-3 italic">Vibe check</p>
        <Link
          href="/"
          transitionTypes={["nav-back"]}
          aria-label="Close vibe check"
          className="grid size-10 place-items-center rounded-full hover:bg-muted"
        >
          <X aria-hidden className="size-5" strokeWidth={1.5} />
        </Link>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <VibeCheckFlow cards={cards} niches={niches} blurbs={VIBE_BLURBS} />
      </div>
    </Screen>
  )
}
