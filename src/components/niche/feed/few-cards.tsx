"use client"

import type { ReactNode } from "react"
import { MediaImage } from "@/components/ds/media-image"
import { PaletteTint } from "@/components/ds/palette-tint"
import { SaveButton } from "@/components/ds/save-button"
import type { FeedItem } from "@/lib/feed/types"
import { focusOf } from "@/lib/images/curate"
import { formatAge } from "@/lib/time"
import { FeedCard } from "./feed-card"

const str = (value: unknown) => (typeof value === "string" && value ? value : null)
const isStory = (item: FeedItem) =>
  item.source === "news" || (item.type === "article" && Boolean(item.imageUrl))

/** One or two stories: image beside the headline, like a magazine's half-page. */
function EditorialCard({ item, now }: { item: FeedItem; now: number }) {
  const outlet = str(item.meta.outlet) ?? item.subtitle
  const age = formatAge(item.publishedAt, new Date(now))
  const summary = str(item.meta.summary)
  if (!item.imageUrl) {
    // No picture: a typographic row (rule, outlet, big serif headline), never an empty box.
    return (
      <article className="max-w-3xl border-t border-foreground/80 pt-4">
        <p className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">
          {[outlet, age].filter(Boolean).join(" · ")}
        </p>
        <h3 className="mt-2 font-serif text-title-1 leading-tight text-balance italic md:text-[40px]">
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {item.title}
          </a>
        </h3>
        {summary ? (
          <p className="mt-3 line-clamp-3 max-w-2xl text-callout text-muted-foreground">
            {summary}
          </p>
        ) : null}
      </article>
    )
  }
  return (
    <article className="group relative grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-center md:gap-8">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={-1}
        aria-hidden
        className="relative block aspect-[4/3] overflow-hidden rounded-3xl bg-muted"
      >
        {item.imageUrl ? (
          <MediaImage
            src={item.imageUrl}
            alt=""
            sizes="(max-width: 768px) 100vw, 560px"
            focus={focusOf(item)}
          />
        ) : null}
        <PaletteTint item={item} />
      </a>
      <div>
        <p className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">
          {[outlet, age].filter(Boolean).join(" · ")}
        </p>
        <h3 className="mt-2 font-serif text-title-2 leading-tight text-balance italic md:text-title-1">
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {item.title}
          </a>
        </h3>
        {summary ? (
          <p className="mt-3 line-clamp-3 text-callout text-muted-foreground">{summary}</p>
        ) : null}
      </div>
      <SaveButton
        item={{
          id: item.id,
          title: item.title,
          url: item.url,
          imageUrl: item.imageUrl,
          source: item.source,
          subtitle: item.subtitle,
        }}
        tone="overlay"
        className="absolute top-3 left-3"
      />
    </article>
  )
}

/**
 * A grid's worth of cards when there are only one or two: stories become a
 * wide editorial row; other cards keep their own shape at a sensible width.
 * Never a lone card beside two empty columns.
 */
export function FewCards({
  items,
  now,
  wrap = (_item, node) => node,
}: {
  items: readonly FeedItem[]
  now: number
  /** Wrap each card (e.g. in a TasteCard for signals). */
  wrap?: (item: FeedItem, node: ReactNode) => ReactNode
}) {
  return (
    <ul className="space-y-8">
      {items.map((item) => (
        <li key={item.id} className={isStory(item) ? undefined : "max-w-md"}>
          {wrap(
            item,
            isStory(item) ? (
              <EditorialCard item={item} now={now} />
            ) : (
              <FeedCard item={item} now={now} />
            ),
          )}
        </li>
      ))}
    </ul>
  )
}
