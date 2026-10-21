"use client"

import { Play } from "lucide-react"
import { useRef, useState } from "react"
import { MediaImage } from "@/components/ds/media-image"
import { FitSheetLoader } from "@/components/fits/fit-tile"
import { feedItemPin } from "@/components/moodboard/pin-card"
import { PinSheet } from "@/components/moodboard/pin-sheet"
import { ArtistSheet } from "@/components/niche/artists-row"
import { TasteCard } from "@/components/taste/taste-card"
import { CopOrDrop } from "@/components/votes/cop-or-drop"
import { gestures } from "@/lib/design/tokens"
import type { FeedItem } from "@/lib/feed/types"
import { youtubeCrop } from "@/lib/images/youtube-crop"
import { cn } from "@/lib/utils"
import { openReels } from "@/lib/video/reels-store"
import { altOf, focusOf } from "@/lib/images/curate"

const str = (value: unknown) => (typeof value === "string" && value ? value : null)

/** What a look's caption says: who, what they're wearing, which scene. Only real fields. */
export function fitCaption(item: FeedItem): {
  who: string | null
  wearing: string | null
  niche: string | null
} {
  const seenOn = str(item.meta.seenOn)
  const who =
    item.type === "fit"
      ? item.subtitle
      : seenOn
        ? `Seen on ${seenOn}`
        : item.source === "youtube"
          ? (str(item.meta.channel) ?? item.subtitle)
          : item.subtitle
  return {
    who,
    wearing: str(item.meta.brandNames) ?? str(item.meta.wearingName),
    niche: str(item.meta.nicheName),
  }
}

const KIND: Partial<Record<FeedItem["type"], string>> = {
  fit: "Fit",
  video: "Fit check",
  pin: "Look",
}

function Tile({ item, hero, onOpen }: { item: FeedItem; hero: boolean; onOpen: () => void }) {
  const [revealed, setRevealed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)
  const caption = fitCaption(item)
  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  return (
    <button
      type="button"
      onPointerDown={(event) => {
        if (event.pointerType !== "touch") return
        longPressed.current = false
        timer.current = setTimeout(() => {
          longPressed.current = true
          setRevealed(true)
        }, gestures.longPressMs)
      }}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={(event) => event.preventDefault()}
      onClick={() => {
        if (longPressed.current) {
          longPressed.current = false
          return
        }
        onOpen()
      }}
      aria-label={[KIND[item.type] ?? "Look", caption.who, caption.wearing]
        .filter(Boolean)
        .join(", ")}
      className={cn(
        "group relative block w-full overflow-hidden rounded-2xl bg-muted text-left select-none [-webkit-touch-callout:none]",
        hero ? "aspect-[4/5]" : "aspect-[3/4]",
      )}
    >
      {item.imageUrl ? (
        <MediaImage
          focus={focusOf(item)}
          src={item.imageUrl}
          alt={altOf(item)}
          sizes={hero ? "(max-width: 768px) 100vw, 560px" : "(max-width: 768px) 50vw, 280px"}
          className={cn(
            "transition-transform duration-500 ease-out",
            // YouTube thumbnails carry black bars: zoom past them (no hover zoom on top).
            youtubeCrop(item.imageUrl, { short: item.meta.short === true, frame: "portrait" }) ||
              "group-hover:scale-[1.03]",
          )}
        />
      ) : null}
      <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-overline font-medium text-white uppercase backdrop-blur-md">
        {item.type === "video" ? (
          <Play aria-hidden className="size-3" fill="currentColor" strokeWidth={0} />
        ) : null}
        {KIND[item.type] ?? "Look"}
      </span>
      <span
        className={cn(
          "absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-10 text-white transition-opacity duration-200",
          revealed
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
        )}
      >
        {caption.wearing ? (
          <span className={cn("font-semibold", hero ? "text-callout" : "text-footnote")}>
            {caption.wearing}
          </span>
        ) : null}
        <span className="truncate text-caption opacity-80">
          {[caption.who, caption.niche].filter(Boolean).join(" · ")}
        </span>
      </span>
    </button>
  )
}

/**
 * The Fit as an editorial grid: one tall hero (fit of the day) beside
 * smaller tiles. Captions (brands, scene) appear on hover or long-press.
 */
export function FitEditorial({ items }: { items: readonly FeedItem[] }) {
  const [open, setOpen] = useState<FeedItem | null>(null)
  const [hero, ...others] = items
  if (!hero) return null
  // Tiles come in pairs beside the hero: an odd one out would leave a hole in the grid.
  const rest = others.length > 1 ? others.slice(0, others.length - (others.length % 2)) : others
  const openItem = (item: FeedItem) => (item.type === "video" ? openReels(item) : setOpen(item))
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2 md:gap-3",
        // Two tiles stack beside the hero; four make a 2×2 beside it.
        rest.length <= 2 ? "md:grid-cols-3" : "md:grid-cols-4",
      )}
    >
      <div className="col-span-2 md:row-span-2">
        <TasteCard item={hero} niche={null} reason={null}>
          <Tile item={hero} hero onOpen={() => openItem(hero)} />
          <CopOrDrop item={hero} className="mt-2" />
        </TasteCard>
      </div>
      {rest.map((item) => (
        <TasteCard key={item.id} item={item} niche={null} reason={null}>
          <Tile item={item} hero={false} onOpen={() => openItem(item)} />
          <CopOrDrop item={item} size="sm" className="mt-2" />
        </TasteCard>
      ))}
      {open ? <Opened item={open} onClose={() => setOpen(null)} /> : null}
    </div>
  )
}

function Opened({ item, onClose }: { item: FeedItem; onClose: () => void }) {
  if (item.type === "fit") return <FitSheetLoader id={String(item.meta.fitId)} onClose={onClose} />
  const artistSlug = str(item.meta.artistSlug)
  if (artistSlug) {
    return (
      <ArtistSheet
        artist={{ slug: artistSlug, name: item.title, imageUrl: item.imageUrl }}
        onClose={onClose}
      />
    )
  }
  const pin = feedItemPin(item)
  return (
    <PinSheet
      pin={pin}
      pins={[pin]}
      pinterestQuery={null}
      onOpen={() => undefined}
      onClose={onClose}
    />
  )
}
