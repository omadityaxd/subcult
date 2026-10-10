import { Search } from "lucide-react"
import { connection } from "next/server"
import { Suspense } from "react"
import { SectionHeader } from "@/components/ds/section-header"
import { InfiniteFeed } from "@/components/home/infinite-feed"
import { StoriesRow } from "@/components/home/stories-row"
import { VibeCheckCard } from "@/components/home/vibe-check-card"
import { FeedSkeleton } from "@/components/niche/feed/live-panels"
import { PullToRefresh } from "@/components/shell/pull-to-refresh"
import { Screen } from "@/components/shell/screen"
import { SearchButton } from "@/components/shell/search-button"
import { Skeleton } from "@/components/ui/skeleton"
import { featuredOrder } from "@/lib/feed/featured"
import { getHomePage } from "@/lib/feed/home"

const STORY_COUNT = 12

export default function ForYouPage() {
  return (
    <Screen>
      <PullToRefresh>
        <header className="container-page flex items-center justify-between pt-[calc(env(safe-area-inset-top)+1rem)] pb-2 md:hidden">
          <span className="font-serif text-[30px] leading-none italic">subcult</span>
          <SearchButton>
            <Search aria-hidden className="size-[22px]" strokeWidth={1.5} />
          </SearchButton>
        </header>

        <div className="container-page pt-4 md:pt-12">
          <h1 className="sr-only md:not-sr-only md:mb-8 md:font-serif md:text-title-1 md:italic">
            For you
          </h1>
          <Suspense fallback={<StoriesSkeleton />}>
            <Stories />
          </Suspense>

          <div className="mt-8 md:mt-10">
            <VibeCheckCard />
          </div>

          <section className="mt-12">
            <SectionHeader overline="Across the niches" title="Latest" />
            <Suspense fallback={<FeedSkeleton count={6} />}>
              <HomeFeed />
            </Suspense>
          </section>
        </div>
      </PullToRefresh>
    </Screen>
  )
}

async function Stories() {
  await connection()
  const now = new Date()
  return (
    <StoriesRow
      niches={featuredOrder(now).slice(0, STORY_COUNT)}
      day={now.toISOString().slice(0, 10)}
    />
  )
}

async function HomeFeed() {
  await connection()
  const now = new Date()
  const first = await getHomePage(0, now)
  return <InfiniteFeed initial={first} now={now.getTime()} />
}

function StoriesSkeleton() {
  return (
    <div aria-hidden className="flex gap-4 overflow-hidden pb-2">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="w-[4.5rem] shrink-0">
          <Skeleton className="size-[4.5rem] rounded-full" />
          <Skeleton className="mx-auto mt-2 h-3 w-12" />
        </div>
      ))}
    </div>
  )
}
