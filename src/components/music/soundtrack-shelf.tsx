"use client"

import { useEffect, useState } from "react"
import { MediaImage } from "@/components/ds/media-image"
import { ResponsiveSheet } from "@/components/ds/responsive-sheet"
import { Skeleton } from "@/components/ui/skeleton"
import type { Soundtrack } from "@/lib/music/soundtrack"
import type { ApiResponse } from "@/lib/request"
import { SoundtrackHeader, TrackList } from "./track-list"

export interface ShelfNiche {
  slug: string
  name: string
  imageUrl: string | null
  /** Why it's here ("Sister scene", "Two hops away"). */
  label: string
}

/** Neighbouring niches' soundtracks as in-app playlists: tap opens the track list here. */
export function SoundtrackShelf({ niches }: { niches: readonly ShelfNiche[] }) {
  const [open, setOpen] = useState<ShelfNiche | null>(null)
  if (niches.length === 0) return null
  return (
    <>
      <ul className="-mx-(--gutter) no-scrollbar flex gap-4 overflow-x-auto px-(--gutter) pb-1">
        {niches.map((niche) => (
          <li key={niche.slug} className="w-36 shrink-0">
            <button
              type="button"
              onClick={() => setOpen(niche)}
              className="group block w-full text-left"
            >
              <span className="relative block aspect-square overflow-hidden rounded-xl bg-muted transition-transform group-active:scale-[0.97]">
                {niche.imageUrl ? <MediaImage src={niche.imageUrl} alt="" sizes="144px" /> : null}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2.5 pt-8 font-serif text-title-3 leading-tight text-white italic">
                  {niche.name}
                </span>
              </span>
              <span className="mt-1.5 block truncate text-footnote text-muted-foreground">
                This is {niche.name} · {niche.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open ? (
        <ResponsiveSheet
          open
          onOpenChange={(next) => (next ? undefined : setOpen(null))}
          title={`This is ${open.name}`}
        >
          <ShelfSoundtrack key={open.slug} slug={open.slug} />
        </ResponsiveSheet>
      ) : null}
    </>
  )
}

function ShelfSoundtrack({ slug }: { slug: string }) {
  const [soundtrack, setSoundtrack] = useState<Soundtrack | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/music/soundtrack?niche=${encodeURIComponent(slug)}`)
      .then((response) => response.json() as Promise<ApiResponse<Soundtrack>>)
      .then((body) => {
        if (cancelled) return
        if (body.success) setSoundtrack(body.data)
        else setFailed(true)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  if (failed || (soundtrack && soundtrack.tracks.length === 0)) {
    return <p className="text-callout text-muted-foreground">No previews for this one yet.</p>
  }
  if (!soundtrack) {
    return (
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-12 rounded-xl" />
        ))}
      </div>
    )
  }
  return (
    <div className="space-y-5">
      <SoundtrackHeader soundtrack={soundtrack} />
      <TrackList soundtrack={soundtrack} />
    </div>
  )
}
