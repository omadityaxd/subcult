"use client"

import { Search } from "lucide-react"
import { useDeferredValue, useState } from "react"
import { NicheCard } from "@/components/niche/niche-card"
import { OPEN_SEARCH_EVENT } from "@/components/shell/nav"
import type { NichePreset } from "@/lib/niches/catalog"
import { presetMatches } from "@/lib/niches/preset-search"
import { SummonNiche } from "./summon-niche"

interface NicheBrowserProps {
  presets: readonly NichePreset[]
}

/** Filterable grid of every niche: 2 columns on phones, 3 on tablets, 4 on desktop. */
export function NicheBrowser({ presets }: NicheBrowserProps) {
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const needle = deferredQuery.trim().toLowerCase()
  const results = needle ? presets.filter((niche) => presetMatches(niche, needle)) : presets

  return (
    <section aria-labelledby="all-niches" className="container-page">
      <div className="sticky top-[calc(var(--nav-bar-height)+env(safe-area-inset-top))] z-20 -mx-(--gutter) bg-background/85 px-(--gutter) py-3 backdrop-blur-xl md:top-0">
        <label className="relative block">
          <span className="sr-only">Search niches</span>
          <Search
            aria-hidden
            strokeWidth={1.5}
            className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search any vibe"
            autoComplete="off"
            enterKeyHint="search"
            className="h-12 w-full rounded-full bg-muted pr-16 pl-11 text-body placeholder:text-subtle focus-visible:outline-2"
          />
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))}
            className="absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-border px-1.5 text-caption text-muted-foreground md:block"
          >
            ⌘K
          </button>
        </label>
      </div>

      <h2
        id="all-niches"
        className="mt-6 mb-4 text-overline font-medium text-muted-foreground uppercase"
      >
        {needle
          ? `${results.length} result${results.length === 1 ? "" : "s"}`
          : `All niches · ${presets.length}`}
      </h2>

      {results.length > 0 ? (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 md:gap-x-5 md:gap-y-8 lg:grid-cols-4">
          {results.map((niche) => (
            <li key={niche.slug}>
              <NicheCard niche={niche} />
            </li>
          ))}
        </ul>
      ) : (
        <SummonNiche key={needle} query={deferredQuery.trim()} presets={presets} />
      )}
    </section>
  )
}
