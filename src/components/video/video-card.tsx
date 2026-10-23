"use client"

import { Play } from "lucide-react"
import { useEffect, useRef } from "react"
import { MediaImage } from "@/components/ds/media-image"
import { SaveButton } from "@/components/ds/save-button"
import type { FeedItem } from "@/lib/feed/types"
import { openReels, registerVideo } from "@/lib/video/reels-store"

const savedShape = (item: FeedItem) => ({
  id: item.id,
  title: item.title,
  url: item.url,
  imageUrl: item.imageUrl,
  source: item.source,
  subtitle: item.subtitle,
})

/**
 * A video in the feed, as a facade: the thumbnail and a play button, no
 * YouTube player until it's tapped (no iframes loading in the background,
 * no spinners). A tap opens the full-screen viewer, which plays it.
 */
export function VideoCard({ item, meta }: { item: FeedItem; meta: string }) {
  const articleRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = articleRef.current
    return element ? registerVideo(item, element) : undefined
  }, [item])

  return (
    <article ref={articleRef}>
      <button
        type="button"
        onClick={() => openReels(item)}
        aria-label={`Watch ${item.title}`}
        className="group relative block aspect-video w-full overflow-hidden rounded-2xl bg-black"
      >
        {item.imageUrl ? (
          <MediaImage src={item.imageUrl} alt="" sizes="(max-width: 640px) 100vw, 33vw" />
        ) : null}
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-12 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md transition-transform group-active:scale-95">
            <Play
              aria-hidden
              className="size-5 translate-x-0.5"
              fill="currentColor"
              strokeWidth={0}
            />
          </span>
        </span>
      </button>
      <div className="mt-2.5 flex items-start gap-1.5 px-0.5">
        <button type="button" onClick={() => openReels(item)} className="min-w-0 flex-1 text-left">
          <span className="line-clamp-2 text-headline font-semibold">{item.title}</span>
          <span className="mt-0.5 block truncate text-footnote text-muted-foreground">
            {[item.subtitle, meta].filter(Boolean).join(" · ")}
          </span>
        </button>
        <SaveButton item={savedShape(item)} className="size-9 shrink-0" />
      </div>
    </article>
  )
}
