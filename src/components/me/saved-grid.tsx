"use client"

import { Bookmark } from "lucide-react"
import { ButtonLink } from "@/components/ds/button"
import { MediaImage } from "@/components/ds/media-image"
import { SaveButton } from "@/components/ds/save-button"
import { EmptyState } from "@/components/shell/empty-state"
import { type SavedItem, useSaves } from "@/lib/saves"

/** Everything you've double-tapped, newest first. Lives on this device until accounts land. */
export function SavedGrid() {
  const saves = useSaves()

  if (saves.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title="Nothing saved yet"
        body="Double-tap anything in a feed, or hit the bookmark, and it lands here."
        action={
          <ButtonLink href="/explore" variant="outline">
            Find something
          </ButtonLink>
        }
      />
    )
  }

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
      {saves.map((item) => (
        <li key={item.id}>
          <SavedTile item={item} />
        </li>
      ))}
    </ul>
  )
}

function SavedTile({ item }: { item: SavedItem }) {
  return (
    <article className="group relative">
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
          {item.imageUrl ? (
            <MediaImage src={item.imageUrl} alt="" sizes="(min-width: 1024px) 18vw, 45vw" />
          ) : (
            <p className="line-clamp-5 p-4 font-serif text-title-3 text-balance italic">
              {item.title}
            </p>
          )}
        </div>
        <p className="mt-2 line-clamp-2 text-footnote font-medium">{item.title}</p>
        {item.subtitle ? (
          <p className="truncate text-caption text-muted-foreground">{item.subtitle}</p>
        ) : null}
      </a>
      <div className="absolute top-2 right-2">
        <SaveButton item={item} tone={item.imageUrl ? "overlay" : "plain"} />
      </div>
    </article>
  )
}
