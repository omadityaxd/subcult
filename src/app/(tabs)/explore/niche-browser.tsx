"use client"

import { Search } from "lucide-react"
import Link from "next/link"
import { useDeferredValue, useState } from "react"
import { EmptyState } from "@/components/shell/empty-state"
import { Pressable } from "@/components/shell/pressable"
import { NICHE_PRESETS } from "@/lib/niches/presets"

/** Search + grid over the preset catalog. Typing an unknown vibe will trigger generation (Phase 2). */
export function NicheBrowser() {
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const needle = deferredQuery.trim().toLowerCase()
  const results = needle
    ? NICHE_PRESETS.filter((niche) => niche.name.includes(needle))
    : NICHE_PRESETS

  return (
    <div className="px-4">
      <label className="relative block">
        <span className="sr-only">Search niches</span>
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="search any vibe…"
          autoComplete="off"
          enterKeyHint="search"
          className="h-10 w-full rounded-xl bg-muted pr-3 pl-10 text-[17px] placeholder:text-muted-foreground focus-visible:outline-2"
        />
      </label>

      {results.length > 0 ? (
        <ul className="mt-5 grid grid-cols-2 gap-3">
          {results.map((niche) => (
            <li key={niche.slug}>
              <Pressable>
                <Link
                  href={`/n/${niche.slug}`}
                  transitionTypes={["nav-forward"]}
                  className="flex aspect-[4/3] flex-col justify-between rounded-2xl bg-card p-4"
                >
                  <span aria-hidden className="text-3xl">
                    {niche.emoji}
                  </span>
                  <span className="font-display text-[17px] leading-tight font-semibold">
                    {niche.name}
                  </span>
                </Link>
              </Pressable>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          className="mt-5"
          emoji="🔭"
          title={`"${deferredQuery.trim()}" isn't on the map yet`}
          body="soon you'll be able to summon any niche into existence. for now, try one of ours."
        />
      )}
    </div>
  )
}
