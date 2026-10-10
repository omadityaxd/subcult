import { Newspaper, Play } from "lucide-react"
import Image from "next/image"
import type { FeedItem } from "@/lib/feed/types"
import { formatAge } from "@/lib/time"
import { cn } from "@/lib/utils"

const TYPE_LABEL: Record<FeedItem["type"], string> = {
  track: "track",
  artist: "artist",
  playlist: "playlist",
  video: "video",
  article: "the tea",
}

interface FeedCardProps {
  item: FeedItem
  now: Date
}

/** One outbound card; layout adapts to the item type. */
export function FeedCard({ item, now }: FeedCardProps) {
  const age = formatAge(item.publishedAt, now)
  const meta = [TYPE_LABEL[item.type], item.subtitle, item.type !== "track" ? age : null]
    .filter(Boolean)
    .join(" · ")

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block overflow-hidden rounded-2xl bg-card transition-transform duration-150 active:scale-[0.98]"
    >
      {item.type === "video" ? <VideoThumb item={item} /> : null}
      <div className="flex items-center gap-3 p-3">
        {item.type !== "video" ? <SquareArt item={item} /> : null}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[15px] leading-snug font-semibold">{item.title}</p>
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{meta}</p>
        </div>
      </div>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

function VideoThumb({ item }: { item: FeedItem }) {
  return (
    <div className="relative aspect-video bg-muted">
      {item.imageUrl ? (
        <Image
          src={item.imageUrl}
          alt=""
          fill
          unoptimized
          sizes="(max-width: 480px) 100vw, 480px"
          className="object-cover"
        />
      ) : null}
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid size-12 place-items-center rounded-full bg-black/60 text-white backdrop-blur">
          <Play aria-hidden className="size-5 translate-x-0.5" fill="currentColor" />
        </span>
      </span>
    </div>
  )
}

function SquareArt({ item }: { item: FeedItem }) {
  if (!item.imageUrl) {
    return (
      <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-niche/15 text-niche">
        <Newspaper aria-hidden className="size-6" />
      </span>
    )
  }
  return (
    <span
      className={cn(
        "relative size-14 shrink-0 overflow-hidden bg-muted",
        item.type === "artist" ? "rounded-full" : "rounded-xl",
      )}
    >
      <Image src={item.imageUrl} alt="" fill unoptimized sizes="56px" className="object-cover" />
    </span>
  )
}
