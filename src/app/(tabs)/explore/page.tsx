import type { Metadata } from "next"
import { Suspense } from "react"
import { LargeTitle } from "@/components/shell/large-title"
import { Screen } from "@/components/shell/screen"
import { HubCard, hubSummary } from "@/components/explore/hub-card"
import { NICHE_PRESETS, TAXONOMY } from "@/lib/niches/catalog"
import { rootHubs } from "@/lib/taxonomy/hubs"
import { NicheBrowser } from "./niche-browser"
import { TrendingRow, TrendingRowSkeleton } from "./trending-row"

export const metadata: Metadata = { title: "Explore" }

export default function ExplorePage() {
  // The underground hub leads; other hubs (Alt-Metal Revival) sit beside it.
  const hubs = rootHubs(TAXONOMY).flatMap((slug) => {
    const hub = hubSummary(slug)
    return hub ? [hub] : []
  })
  return (
    <Screen>
      <LargeTitle overline="Every corner, sorted by vibe" title="Explore" />
      <div className="container-page mb-10 grid gap-4 lg:grid-cols-[2fr_1fr]">
        {hubs.map((hub, index) => (
          <HubCard key={hub.slug} hub={hub} size={index === 0 ? "lg" : "md"} />
        ))}
      </div>
      <Suspense fallback={<TrendingRowSkeleton />}>
        <TrendingRow />
      </Suspense>
      <NicheBrowser presets={NICHE_PRESETS} />
    </Screen>
  )
}
