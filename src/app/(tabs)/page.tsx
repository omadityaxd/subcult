import type { Metadata } from "next"
import { Search } from "lucide-react"
import { connection } from "next/server"
import { Suspense } from "react"
import { DailyPicks, GrailOfTheDay } from "@/components/home/daily-picks"
import { ForYouFeed } from "@/components/home/for-you-feed"
import { TodaySkeleton } from "@/components/home/today"
import { TodayServer } from "@/components/home/today-server"
import { NowSpinning } from "@/components/home/now-spinning"
import { StoriesRow } from "@/components/home/stories-row"
import { VibeCheckCard } from "@/components/home/vibe-check-card"
import { FeedSkeleton } from "@/components/niche/feed/live-panels"
import { PullToRefresh } from "@/components/shell/pull-to-refresh"
import { Screen } from "@/components/shell/screen"
import { SearchButton } from "@/components/shell/search-button"
import { NotificationBell } from "@/components/alerts/notification-bell"
import { Skeleton } from "@/components/ui/skeleton"
import { featuredOrder } from "@/lib/feed/featured"
import { getDailyPicks } from "@/lib/feed/daily"
import { TAXONOMY } from "@/lib/niches/catalog"

export const metadata: Metadata = {
  title: { absolute: "subcult: your daily subculture issue" },
  description:
    "A new issue of your subculture's magazine every day: the tea, the fits, the grails, the sounds and what's rising in your scenes.",
}

/** The whole featured cluster, plus a few of the day's rotating picks. */
const STORY_COUNT = TAXONOMY.featured().length + 4

export default function ForYouPage() {
  return (
    <Screen>
      <PullToRefresh>
        <header className="container-page flex items-center justify-end pt-[calc(env(safe-area-inset-top)+1rem)] pb-2 md:hidden">
          {/* The cover carries the masthead: no second wordmark above it. */}
          <div className="flex items-center gap-4">
            <NotificationBell className="[&_svg]:size-[22px]" />
            <SearchButton>
              <Search aria-hidden className="size-[22px]" strokeWidth={1.5} />
            </SearchButton>
          </div>
        </header>

        <div className="container-page pt-4 md:pt-12">
          <h1 className="sr-only">Today&apos;s issue</h1>
          <Suspense fallback={<StoriesSkeleton />}>
            <Stories />
          </Suspense>

          <div className="mt-6">
            <Suspense fallback={<FeedSkeleton count={3} />}>
              <HomeFeed />
            </Suspense>
          </div>
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
  // Started here, awaited below the cover: the issue (and its cover, the LCP)
  // streams as soon as it's built instead of waiting on the day's picks.
  const picks = getDailyPicks(now)
  // Not every issue shows them; a failure surfaces where they're awaited, if anywhere.
  picks.catch(() => undefined)
  return (
    <ForYouFeed
      initial={null}
      now={now.getTime()}
      today={
        <Suspense fallback={<TodaySkeleton />}>
          <TodayServer
            coldExtras={
              <>
                <VibeCheckCard />
                <Suspense fallback={null}>
                  <Picks picks={picks} />
                </Suspense>
              </>
            }
          />
        </Suspense>
      }
      spinning={
        <Suspense fallback={null}>
          <Spinning picks={picks} />
        </Suspense>
      }
    />
  )
}

type PicksPromise = ReturnType<typeof getDailyPicks>

async function Picks({ picks }: { picks: PicksPromise }) {
  const { look, brand, grail } = await picks
  return (
    <DailyPicks look={look} brand={brand} grail={grail ? <GrailOfTheDay item={grail} /> : null} />
  )
}

async function Spinning({ picks }: { picks: PicksPromise }) {
  return <NowSpinning tracks={(await picks).spinning} />
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
