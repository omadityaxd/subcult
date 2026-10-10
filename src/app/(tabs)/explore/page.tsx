import type { Metadata } from "next"
import { LargeTitle } from "@/components/shell/large-title"
import { Screen } from "@/components/shell/screen"
import { NICHE_PRESETS } from "@/lib/niches/catalog"
import { NicheBrowser } from "./niche-browser"

export const metadata: Metadata = { title: "explore" }

export default function ExplorePage() {
  return (
    <Screen>
      <LargeTitle title="explore" subtitle="every corner of the internet, sorted by vibe" />
      <NicheBrowser presets={NICHE_PRESETS} />
    </Screen>
  )
}
