"use client"

import { useState } from "react"
import { MediaImage } from "@/components/ds/media-image"
import type { FeedItem } from "@/lib/feed/types"
import type { Pin, PinSource } from "@/lib/moodboard/types"
import { ArtistSheet } from "@/components/niche/artists-row"
import { PinSheet } from "./pin-sheet"

const num = (value: unknown) => (typeof value === "number" ? value : null)
const str = (value: unknown) => (typeof value === "string" ? value : null)

/** A moodboard feed item back as a pin (meta carries what the sheet needs). */
export function feedItemPin(item: FeedItem): Pin {
  const creditUrl = str(item.meta.creditUrl)
  return {
    id: item.id.replace(/^pin:/, ""),
    source: (item.source === "subcult" ? "artist" : item.source) as PinSource,
    imageUrl: item.imageUrl ?? "",
    largeUrl: str(item.meta.largeUrl) ?? item.imageUrl ?? "",
    width: num(item.meta.width),
    height: num(item.meta.height),
    color: str(item.meta.color),
    title: item.title,
    credit: item.subtitle && creditUrl ? { label: item.subtitle, url: creditUrl } : null,
    pageUrl: item.url,
    downloadLocation: str(item.meta.downloadLocation) ?? undefined,
  }
}

/** Image-only feed card: tap opens the pin sheet in-app. */
export function PinCard({ item }: { item: FeedItem }) {
  const [open, setOpen] = useState<Pin | null>(null)
  const pin = feedItemPin(item)
  const artistSlug = str(item.meta.artistSlug)
  return (
    <article>
      <button
        type="button"
        onClick={() => setOpen(pin)}
        aria-label={pin.title ?? "Open pin"}
        className="relative block w-full overflow-hidden rounded-2xl bg-muted transition-transform active:scale-[0.98]"
        style={{
          aspectRatio: pin.width && pin.height ? `${pin.width} / ${pin.height}` : "4 / 5",
          backgroundColor: pin.color ?? undefined,
        }}
      >
        <MediaImage src={pin.imageUrl} alt="" sizes="(max-width: 640px) 100vw, 33vw" />
      </button>
      {artistSlug ? (
        <SceneCaption
          name={item.title}
          note={str(item.meta.note)}
          wearing={str(item.meta.wearingName)}
        />
      ) : pin.credit ? (
        <p className="mt-1.5 truncate px-0.5 text-caption text-muted-foreground">
          {pin.credit.label}
        </p>
      ) : null}
      {open && artistSlug ? (
        <ArtistSheet
          artist={{ slug: artistSlug, name: item.title, imageUrl: item.imageUrl }}
          onClose={() => setOpen(null)}
        />
      ) : open ? (
        <PinSheet
          key={open.id}
          pin={open}
          pins={[pin]}
          pinterestQuery={null}
          onOpen={setOpen}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </article>
  )
}

/** Scene photo context: who, why they matter here, and what they're seen wearing. */
function SceneCaption({
  name,
  note,
  wearing,
}: {
  name: string
  note: string | null
  wearing: string | null
}) {
  return (
    <div className="mt-1.5 px-0.5">
      <p className="truncate text-footnote font-semibold">{name}</p>
      {note ? <p className="line-clamp-2 text-caption text-muted-foreground">{note}</p> : null}
      {wearing ? (
        <span className="mt-1 inline-flex max-w-full items-center rounded-full border border-border px-2 py-0.5 text-caption text-muted-foreground">
          <span className="truncate">Seen wearing {wearing}</span>
        </span>
      ) : null}
    </div>
  )
}
