"use client"

import { type ReactNode, useState } from "react"
import { FEED_FILTERS, type FeedFilter } from "@/lib/feed/filters"
import type { HomePage } from "@/lib/feed/home"
import { cn } from "@/lib/utils"
import { InfiniteFeed } from "./infinite-feed"

/**
 * For You: today's issue first, then, after its back page, the filter
 * chips and the endless feed for anyone who wants to keep browsing.
 */
export function ForYouFeed({
  initial,
  now,
  today,
  spinning,
}: {
  initial: HomePage | null
  now: number
  /** Server-rendered issue (streams in its own Suspense boundary). */
  today: ReactNode
  spinning: ReactNode
}) {
  const [filter, setFilter] = useState<FeedFilter>("all")
  return (
    <>
      <div className="mt-2">{today}</div>

      <section id="latest" aria-label="Keep browsing" className="mt-20 scroll-mt-4">
        <nav
          aria-label="Filter the feed"
          className="sticky top-0 z-20 -mx-(--gutter) bg-background/85 px-(--gutter) pt-safe pb-3 backdrop-blur-xl"
        >
          <p className="pt-3 text-caption font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Keep browsing
          </p>
          <ul className="mt-2 no-scrollbar flex gap-2 overflow-x-auto">
            {FEED_FILTERS.map((chip) => (
              <li key={chip.id}>
                <button
                  type="button"
                  onClick={() => setFilter(chip.id)}
                  aria-pressed={filter === chip.id}
                  className={cn(
                    "h-9 rounded-full px-4 text-footnote font-semibold whitespace-nowrap transition-colors",
                    filter === chip.id
                      ? "bg-foreground text-background"
                      : "border border-border-strong text-muted-foreground hover:text-foreground",
                  )}
                >
                  {chip.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        {filter === "sounds" ? <div className="mt-6">{spinning}</div> : null}
        <div className="mt-6">
          <InfiniteFeed initial={initial} now={now} filter={filter} />
        </div>
      </section>
    </>
  )
}
