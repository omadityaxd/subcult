"use client"

import { useState, useSyncExternalStore } from "react"
import { NicheAvatar } from "@/components/ds/niche-avatar"
import { getAudioEngine } from "@/lib/audio/use-audio"
import type { HomeNiche } from "@/lib/feed/featured"
import { StoryViewer } from "./story-viewer"

const SEEN_KEY = "subcult-stories-seen-v1"
const listeners = new Set<() => void>()

function readSeen(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? "{}"
  } catch {
    return "{}"
  }
}

function markSeen(slug: string, day: string) {
  try {
    const seen = JSON.parse(readSeen()) as Record<string, string>
    localStorage.setItem(SEEN_KEY, JSON.stringify({ ...seen, [slug]: day }))
  } catch {
    // Storage unavailable: rings just stay "unseen".
  }
  listeners.forEach((listener) => listener())
}

function useSeen(): Record<string, string> {
  const raw = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    readSeen,
    () => "{}",
  )
  try {
    return JSON.parse(raw) as Record<string, string>
  } catch {
    return {}
  }
}

/** Instagram-style stories: a gradient ring means you haven't watched today's update. */
export function StoriesRow({ niches, day }: { niches: readonly HomeNiche[]; day: string }) {
  const seen = useSeen()
  const [openAt, setOpenAt] = useState<number | null>(null)

  return (
    <>
      <ul
        aria-label="Stories"
        className="-mx-(--gutter) no-scrollbar flex gap-4 overflow-x-auto px-(--gutter) pb-2 md:gap-5"
      >
        {niches.map((niche, index) => (
          <li key={niche.slug} className="w-[4.5rem] shrink-0">
            <button
              type="button"
              onClick={() => {
                // Inside the tap, so iOS lets the story's music start once it loads.
                getAudioEngine().unlock()
                setOpenAt(index)
              }}
              className="group block w-full text-center"
            >
              <NicheAvatar
                slug={niche.slug}
                name={niche.name}
                palette={niche.palette}
                imageUrl={niche.imageUrl}
                unseen={seen[niche.slug] !== day}
                className="transition-transform group-active:scale-95"
              />
              <span className="mt-1.5 block truncate text-caption text-muted-foreground">
                {niche.name}
                {/* The accessible name starts with the visible label: "rage story". */}
                <span className="sr-only"> story</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {openAt !== null ? (
        <StoryViewer
          niches={niches}
          startIndex={openAt}
          onSeen={(slug) => markSeen(slug, day)}
          onClose={() => setOpenAt(null)}
        />
      ) : null}
    </>
  )
}
