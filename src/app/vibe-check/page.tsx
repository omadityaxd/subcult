import { X } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"
import { Screen } from "@/components/shell/screen"
import { type NicheInfo, VibeCheckFlow } from "@/components/vibe/vibe-check-flow"
import { TAXONOMY, findPreset } from "@/lib/niches/catalog"
import { VIBE_BLURBS } from "@/lib/vibe/data"
import { vibeSession } from "@/lib/vibe/pool-server"

export const metadata: Metadata = {
  title: "Vibe check",
  description: "10 to 16 swipes, one brutally accurate niche mix. Never the same deck twice.",
}

/** Today's live pool, picked per request (inside Suspense: the page shell paints first). */
async function VibeDeckLoader() {
  await connection()
  const { cards, seed } = await vibeSession()
  const reachable = new Set(
    cards.flatMap((card) => [
      ...Object.keys(card.weights),
      ...Object.keys(card.pair?.a.weights ?? {}),
      ...Object.keys(card.pair?.b.weights ?? {}),
    ]),
  )
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

  return <VibeCheckFlow cards={cards} seed={seed} niches={niches} blurbs={VIBE_BLURBS} />
}

function DeckSkeleton() {
  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col px-4 pb-6 md:pt-6">
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-3 flex-1 animate-pulse rounded-[28px] bg-muted" />
      <div className="h-24" />
    </div>
  )
}

/** Full-screen flow (no tab bar): the adaptive swipe deck, then the result. */
export default function VibeCheckPage() {
  return (
    <Screen withTabBar={false} className="flex h-dvh flex-col">
      <header className="flex h-(--nav-bar-height) shrink-0 items-center justify-between px-4 pt-safe">
        <p className="font-serif text-title-3 italic">Vibe check</p>
        <Link
          href="/start?pick=1"
          className="mr-1 ml-auto h-10 rounded-full px-3 text-footnote leading-10 text-muted-foreground hover:bg-muted"
        >
          Pick niches myself
        </Link>
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
        <Suspense fallback={<DeckSkeleton />}>
          <VibeDeckLoader />
        </Suspense>
      </div>
    </Screen>
  )
}
