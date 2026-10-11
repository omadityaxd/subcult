"use client"

import { PreviewCard } from "@base-ui/react/preview-card"
import { ArrowUpRight, Play } from "lucide-react"
import { useRef, useState } from "react"
import { Button } from "@/components/ds/button"
import { DoubleTapSave } from "@/components/ds/double-tap-save"
import { MediaImage } from "@/components/ds/media-image"
import { ResponsiveSheet } from "@/components/ds/responsive-sheet"
import { SaveButton } from "@/components/ds/save-button"
import { gestures } from "@/lib/design/tokens"
import type { FeedItem } from "@/lib/feed/types"
import { useMediaQuery } from "@/lib/design/use-media-query"
import { formatAge } from "@/lib/time"
import { cn } from "@/lib/utils"
import { PinCard } from "@/components/moodboard/pin-card"
import { VideoCard } from "@/components/video/video-card"
import { MusicCard } from "./music-card"
import { SubcultCard } from "./subcult-card"

const SOURCE_LABEL: Record<FeedItem["source"], string> = {
  spotify: "Spotify",
  youtube: "YouTube",
  news: "News",
  arena: "Are.na",
  unsplash: "Unsplash",
  pexels: "Pexels",
  ebay: "eBay",
  subcult: "subcult",
}

const OPEN_LABEL: Record<FeedItem["source"], string> = {
  spotify: "Open in Spotify",
  youtube: "Watch on YouTube",
  news: "Read the story",
  arena: "Open on Are.na",
  unsplash: "View on Unsplash",
  pexels: "View on Pexels",
  ebay: "Buy on eBay",
  subcult: "Open",
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

/** Google's favicon service gives every outlet a small, real image. */
const faviconFor = (outlet: string | null) =>
  outlet
    ? `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(outlet)}`
    : null

function savedShape(item: FeedItem) {
  return {
    id: item.id,
    title: item.title,
    url: item.url,
    imageUrl: item.imageUrl,
    source: item.source,
    subtitle: item.subtitle,
  }
}

interface FeedCardProps {
  item: FeedItem
  /** Optional attribution line, e.g. the niche on the home feed. */
  context?: string
  now?: number
}

/**
 * Image-first feed card. Double-tap (or the bookmark) saves; long-press on
 * touch / hover on desktop opens a peek preview; a normal tap links out.
 */
export function FeedCard({ item, context, now }: FeedCardProps) {
  if (item.source === "subcult") return <SubcultCard item={item} />
  if (item.source === "spotify") return <MusicCard item={item} meta={context ?? ""} />
  if (item.source === "youtube") return <VideoCard item={item} meta={context ?? ""} />
  if (item.type === "pin") return <PinCard item={item} />
  return <ExternalCard item={item} context={context} now={now} />
}

function ExternalCard({ item, context, now }: FeedCardProps) {
  const [peekOpen, setPeekOpen] = useState(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)
  const canHover = useMediaQuery("(hover: hover) and (pointer: fine)")
  const age = formatAge(item.publishedAt, now ? new Date(now) : new Date())
  const meta = [context, SOURCE_LABEL[item.source], item.type === "track" ? null : age]
    .filter(Boolean)
    .join(" · ")

  const card = (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      onPointerDown={(event) => {
        if (event.pointerType !== "touch") return
        longPressed.current = false
        pressTimer.current = setTimeout(() => {
          longPressed.current = true
          setPeekOpen(true)
        }, gestures.longPressMs)
      }}
      onPointerUp={() => pressTimer.current && clearTimeout(pressTimer.current)}
      onPointerLeave={() => pressTimer.current && clearTimeout(pressTimer.current)}
      onPointerCancel={() => pressTimer.current && clearTimeout(pressTimer.current)}
      onClick={(event) => {
        if (longPressed.current) event.preventDefault()
      }}
      onContextMenu={(event) => event.preventDefault()}
      className="group block select-none [-webkit-touch-callout:none]"
    >
      {item.imageUrl ? <Artwork item={item} /> : <Headline item={item} />}
      <div className="mt-2.5 flex items-start gap-2 px-0.5">
        <div className="min-w-0 flex-1">
          {item.imageUrl ? (
            <p className="line-clamp-2 text-headline font-semibold">{item.title}</p>
          ) : null}
          <p className="mt-0.5 truncate text-footnote text-muted-foreground">
            {item.subtitle && item.imageUrl ? `${item.subtitle} · ` : ""}
            {meta}
          </p>
        </div>
      </div>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )

  return (
    <article className="relative">
      <DoubleTapSave item={savedShape(item)}>
        {canHover ? (
          <PreviewCard.Root>
            <PreviewCard.Trigger delay={650} render={card} />
            <PreviewCard.Portal>
              <PreviewCard.Positioner side="right" sideOffset={16} className="z-50">
                <PreviewCard.Popup className="w-80 rounded-2xl border border-border bg-elevated p-3 shadow-pop transition-[opacity,scale] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
                  <PeekBody item={item} meta={meta} />
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        ) : (
          card
        )}
      </DoubleTapSave>
      {item.imageUrl ? (
        <SaveButton item={savedShape(item)} tone="overlay" className="absolute top-2.5 right-2.5" />
      ) : null}
      <ResponsiveSheet open={peekOpen} onOpenChange={setPeekOpen} title={SOURCE_LABEL[item.source]}>
        <PeekBody item={item} meta={meta} />
        <div className="mt-5 flex gap-2">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-foreground text-callout font-medium text-background"
          >
            {OPEN_LABEL[item.source]}{" "}
            <ArrowUpRight aria-hidden className="size-4" strokeWidth={1.5} />
          </a>
          <SaveButton item={savedShape(item)} className="size-11 bg-muted" />
        </div>
        <Button variant="ghost" className="mt-2 w-full" onClick={() => setPeekOpen(false)}>
          Close
        </Button>
      </ResponsiveSheet>
    </article>
  )
}

function Artwork({ item }: { item: FeedItem }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-muted transition-transform duration-300 ease-out group-hover:scale-[1.01] group-active:scale-[0.98]",
        item.type === "video" ? "aspect-video" : "aspect-square",
        item.type === "artist" && "rounded-full",
      )}
    >
      <MediaImage
        src={item.imageUrl ?? ""}
        alt=""
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      />
      {item.type === "video" ? (
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-12 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md">
            <Play
              aria-hidden
              className="size-5 translate-x-0.5"
              fill="currentColor"
              strokeWidth={0}
            />
          </span>
        </span>
      ) : null}
    </div>
  )
}

/** Text-forward card for headlines (news RSS carries no images). */
function Headline({ item }: { item: FeedItem }) {
  const outlet = typeof item.meta.outlet === "string" ? item.meta.outlet : item.subtitle
  const favicon = faviconFor(hostOf(item.url) === "news.google.com" ? outlet : hostOf(item.url))
  return (
    <div className="rounded-2xl border border-border bg-card p-5 transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-active:scale-[0.98]">
      <div className="flex items-center gap-2">
        {favicon ? (
          // eslint-disable-next-line @next/next/no-img-element -- tiny remote favicon, no layout shift
          <img
            src={favicon}
            alt=""
            width={16}
            height={16}
            className="size-4 rounded-sm"
            loading="lazy"
          />
        ) : null}
        <span className="truncate text-footnote font-medium text-muted-foreground">{outlet}</span>
      </div>
      <p className="mt-3 font-serif text-title-3 leading-snug text-balance">{item.title}</p>
    </div>
  )
}

function PeekBody({ item, meta }: { item: FeedItem; meta: string }) {
  return (
    <div>
      {item.imageUrl ? (
        <div
          className={cn(
            "relative overflow-hidden rounded-xl",
            item.type === "video" ? "aspect-video" : "aspect-square",
          )}
        >
          <MediaImage src={item.imageUrl} alt="" sizes="320px" />
        </div>
      ) : null}
      <p className="mt-3 text-headline font-semibold">{item.title}</p>
      {item.subtitle ? (
        <p className="mt-0.5 text-callout text-muted-foreground">{item.subtitle}</p>
      ) : null}
      <p className="mt-1 text-footnote text-subtle">{meta}</p>
    </div>
  )
}
