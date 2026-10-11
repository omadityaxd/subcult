"use client"

import { Heart } from "lucide-react"
import { useEffect, useState } from "react"
import { MediaImage } from "@/components/ds/media-image"
import { ResponsiveSheet } from "@/components/ds/responsive-sheet"
import { Skeleton } from "@/components/ui/skeleton"
import type { FeedItem } from "@/lib/feed/types"
import type { FitView } from "@/lib/fits/types"
import type { ApiResponse } from "@/lib/request"
import { FitDetail, SongSticker } from "./fit-detail"

/** Grid tile for a fit we already have in full (niche Fits tab, profile). */
export function FitTile({ fit, signedIn }: { fit: FitView; signedIn: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <article>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Fit by @${fit.handle}`}
        className="group relative block w-full overflow-hidden rounded-2xl bg-muted active:scale-[0.99]"
        style={{ aspectRatio: `${fit.width} / ${fit.height}` }}
      >
        <MediaImage src={fit.imageUrl} alt="" sizes="(max-width: 640px) 50vw, 25vw" />
        <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent p-2 pt-8 text-white">
          <span className="truncate text-caption font-semibold">@{fit.handle}</span>
          <span className="inline-flex shrink-0 items-center gap-1 text-caption">
            <Heart aria-hidden className="size-3.5" strokeWidth={2} />
            {fit.likeCount}
          </span>
        </span>
        {fit.song ? (
          <span className="absolute top-2 left-2 max-w-[85%]">
            <SongSticker fit={fit} compact />
          </span>
        ) : null}
      </button>
      {open ? (
        <ResponsiveSheet open onOpenChange={setOpen} title={`@${fit.handle}`}>
          <FitDetail fit={fit} signedIn={signedIn} />
        </ResponsiveSheet>
      ) : null}
    </article>
  )
}

/** A fit in the For You feed: loads the full fit when opened. */
export function FitFeedCard({ item }: { item: FeedItem }) {
  const [open, setOpen] = useState(false)
  const width = typeof item.meta.width === "number" ? item.meta.width : 4
  const height = typeof item.meta.height === "number" ? item.meta.height : 5
  return (
    <article>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Fit by ${item.subtitle ?? "someone"}`}
        className="relative block w-full overflow-hidden rounded-2xl bg-muted active:scale-[0.99]"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        {item.imageUrl ? (
          <MediaImage src={item.imageUrl} alt="" sizes="(max-width: 640px) 100vw, 33vw" />
        ) : null}
        <span className="absolute top-2.5 left-2.5 rounded-full bg-black/55 px-2.5 py-1 text-overline font-medium text-white uppercase backdrop-blur-md">
          Fit
        </span>
      </button>
      <p className="mt-1.5 truncate px-0.5 text-footnote text-muted-foreground">{item.subtitle}</p>
      {open ? <FitSheetLoader id={String(item.meta.fitId)} onClose={() => setOpen(false)} /> : null}
    </article>
  )
}

function FitSheetLoader({ id, onClose }: { id: string; onClose: () => void }) {
  const [fit, setFit] = useState<FitView | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetch(`/api/fits/${id}`)
      .then((response) => response.json() as Promise<ApiResponse<FitView>>)
      .then((body) => {
        if (cancelled) return
        if (body.success) setFit(body.data)
        else setFailed(true)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [id])
  return (
    <ResponsiveSheet open onOpenChange={(next) => (next ? undefined : onClose())} title="Fit">
      {fit ? (
        // Liking from the feed sends signed-out people to sign in; the API checks either way.
        <FitDetail fit={fit} signedIn />
      ) : failed ? (
        <p className="text-callout text-muted-foreground">This fit isn&apos;t available.</p>
      ) : (
        <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
      )}
    </ResponsiveSheet>
  )
}

export function FitGrid({ fits, signedIn }: { fits: readonly FitView[]; signedIn: boolean }) {
  return (
    <ul className="columns-2 gap-3 sm:columns-3 xl:columns-4">
      {fits.map((fit) => (
        <li key={fit.id} className="mb-3 break-inside-avoid">
          <FitTile fit={fit} signedIn={signedIn} />
        </li>
      ))}
    </ul>
  )
}
