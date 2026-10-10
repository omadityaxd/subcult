import type { Metadata } from "next"
import { Suspense } from "react"
import { LargeTitle } from "@/components/shell/large-title"
import { Screen } from "@/components/shell/screen"
import { NICHE_PRESETS } from "@/lib/niches/catalog"
import { NicheBrowser } from "./niche-browser"
import { TrendingRow, TrendingRowSkeleton } from "./trending-row"

export const metadata: Metadata = { title: "Explore" }

export default function ExplorePage() {
  return (
    <Screen>
      <LargeTitle overline="Every corner, sorted by vibe" title="Explore" />
      <Suspense fallback={<TrendingRowSkeleton />}>
        <TrendingRow />
      </Suspense>
      <NicheBrowser presets={NICHE_PRESETS} />
    </Screen>
  )
}
