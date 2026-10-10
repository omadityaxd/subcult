"use client"

import { Search } from "lucide-react"
import Link from "next/link"
import { useDeferredValue, useState } from "react"
import { Pressable } from "@/components/shell/pressable"
import type { NichePreset } from "@/lib/niches/catalog"
import { SummonNiche } from "./summon-niche"

interface NicheBrowserProps {
  presets: readonly NichePreset[]
}

/** Search + grid over the niche catalog (presets arrive as props to keep profiles server-side). */
export function NicheBrowser({ presets }: NicheBrowserProps) {
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const needle = deferredQuery.trim().toLowerCase()
  const results = needle ? presets.filter((niche) => niche.name.includes(needle)) : presets

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
        <SummonNiche key={needle} query={deferredQuery.trim()} presets={presets} />
      )}
    </div>
  )
}
