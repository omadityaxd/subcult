"use client"

import { type ReactNode, useState } from "react"
import { FEED_FILTERS, type FeedFilter } from "@/lib/feed/filters"
import type { HomePage } from "@/lib/feed/home"
import { cn } from "@/lib/utils"
import { InfiniteFeed } from "./infinite-feed"

/**
 * For You: filter chips on top, today's visual picks under "All", then the
 * masonry. "Sounds" keeps music compact (the now-spinning row plus track
 * rows); everything else is visual first.
 */
export function ForYouFeed({
  initial,
  now,
  picks,
  spinning,
}: {
  initial: HomePage | null
  now: number
  picks: ReactNode
  spinning: ReactNode
}) {
  const [filter, setFilter] = useState<FeedFilter>("all")
  return (
    <>
      <nav
        aria-label="Filter For You"
        className="sticky top-0 z-20 -mx-(--gutter) bg-background/85 px-(--gutter) pt-safe pb-3 backdrop-blur-xl"
      >
        <ul className="no-scrollbar flex gap-2 overflow-x-auto pt-2">
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

      {filter === "all" ? <div className="mt-4 space-y-8">{picks}</div> : null}
      {filter === "all" || filter === "sounds" ? <div className="mt-8">{spinning}</div> : null}

      <section aria-label="Latest" className="mt-10">
        <InfiniteFeed initial={initial} now={now} filter={filter} />
      </section>
    </>
  )
}
