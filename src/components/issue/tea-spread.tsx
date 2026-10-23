"use client"

import { Cover } from "@/components/ds/cover"
import { MediaImage } from "@/components/ds/media-image"
import { PaletteTint } from "@/components/ds/palette-tint"
import { SaveButton } from "@/components/ds/save-button"
import { TasteCard } from "@/components/taste/taste-card"
import type { FeedItem } from "@/lib/feed/types"
import { formatAge } from "@/lib/time"
import { cn } from "@/lib/utils"
import { focusOf } from "@/lib/images/curate"
import { overlayPalette } from "@/lib/today/tea-image"

const SECONDARY = 2

const str = (value: unknown) => (typeof value === "string" && value ? value : null)
const outletOf = (item: FeedItem) => str(item.meta.outlet) ?? item.subtitle ?? "News"

const saved = (item: FeedItem) => ({
  id: item.id,
  title: item.title,
  url: item.url,
  imageUrl: item.imageUrl,
  source: item.source,
  subtitle: item.subtitle,
})

/** The story's one-line context, when the outlet gave one that says more than the headline. */
function pullQuote(item: FeedItem): string | null {
  const summary = str(item.meta.summary)
  if (!summary) return null
  const clean = summary.trim()
  return clean.length > 24 && !clean.startsWith(item.title.slice(0, 24)) ? clean : null
}

function Byline({ item, now, className }: { item: FeedItem; now: number; className?: string }) {
  const age = formatAge(item.publishedAt, new Date(now))
  return (
    <p className={cn("text-caption", className)}>
      <span className="font-semibold">{outletOf(item)}</span>
      {age ? <span className="opacity-70"> · {age}</span> : null}
    </p>
  )
}

/**
 * A story's picture, framed on its subject. A story whose borrowed photo
 * already appears elsewhere in the issue shows its niche palette instead:
 * never the same picture twice, never text-only.
 */
function Picture({
  item,
  sizes,
  priority = false,
}: {
  item: FeedItem
  sizes: string
  /** The lead story: often the largest thing on screen when the issue opens. */
  priority?: boolean
}) {
  if (item.imageUrl) {
    return (
      <MediaImage
        src={item.imageUrl}
        alt=""
        sizes={sizes}
        focus={focusOf(item)}
        priority={priority}
      />
    )
  }
  const palette = overlayPalette({ ...item, meta: { ...item.meta, imageFallback: true } })
  return palette ? <Cover palette={palette} seed={item.id} className="absolute inset-0" /> : null
}

function Story({
  item,
  className,
  children,
}: {
  item: FeedItem
  className?: string
  children: React.ReactNode
}) {
  return (
    <TasteCard item={item} niche={null} reason={null}>
      <article className={cn("relative", className)}>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="group block">
          {children}
        </a>
        <SaveButton item={saved(item)} tone="overlay" className="absolute top-3 right-3" />
      </article>
    </TasteCard>
  )
}

/**
 * The Tea as an editorial spread: a lead story with its headline set over
 * the image, two stories side by side, then the briefs. Never a stack of
 * identical cards.
 */
export function TeaSpread({ items, now }: { items: readonly FeedItem[]; now: number }) {
  // Heavy news (violence, legal trouble) can run in The Tea but never as its lead.
  const lead = items.find((item) => item.meta.heavy !== true)
  if (!lead) return <Briefs items={items} now={now} />
  const rest = items.filter((item) => item !== lead)
  const secondary = rest.length <= SECONDARY + 1 ? rest : rest.slice(0, SECONDARY)
  const briefs = rest.slice(secondary.length)
  const quote = pullQuote(lead)
  return (
    <div className="space-y-8">
      <Story item={lead} className="-mx-(--gutter) md:mx-0">
        <div className="relative aspect-[4/5] overflow-hidden bg-muted md:aspect-[16/9] md:rounded-3xl">
          <Picture item={lead} sizes="(max-width: 768px) 100vw, 1100px" priority />
          <PaletteTint item={lead} />
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent"
          />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white md:p-8">
            <Byline item={lead} now={now} className="mb-2 tracking-wide uppercase" />
            <h4 className="max-w-3xl font-serif text-[30px] leading-[1.05] text-balance italic group-hover:underline md:text-[52px]">
              {lead.title}
            </h4>
          </div>
        </div>
      </Story>

      {quote ? (
        <blockquote className="border-l-2 border-foreground pl-4 font-serif text-title-3 leading-snug text-balance italic md:max-w-2xl md:text-title-2">
          {quote}
        </blockquote>
      ) : null}

      {secondary.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:gap-x-6">
          {secondary.map((item) => (
            <Story key={item.id} item={item}>
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted">
                <Picture item={item} sizes="(max-width: 768px) 50vw, 540px" />
                <PaletteTint item={item} />
              </div>
              <Byline item={item} now={now} className="mt-3 text-muted-foreground" />
              <h4 className="mt-1 font-serif text-title-3 leading-tight text-balance italic group-hover:underline md:text-title-2">
                {item.title}
              </h4>
            </Story>
          ))}
        </div>
      ) : null}

      {briefs.length > 0 ? <Briefs items={briefs} now={now} /> : null}
    </div>
  )
}

/** The rest of The Tea: a compact list with thumbnails, outlets and times. */
function Briefs({ items, now }: { items: readonly FeedItem[]; now: number }) {
  return (
    <div>
      <p className="mb-1 text-caption font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        Briefs
      </p>
      <ul className="divide-y divide-border border-y border-border">
        {items.map((item) => (
          <li key={item.id}>
            <TasteCard item={item} niche={null} reason={null}>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 py-3"
              >
                <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                  <Picture item={item} sizes="56px" />
                  <PaletteTint item={item} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-callout font-semibold group-hover:underline">
                    {item.title}
                  </span>
                  <Byline item={item} now={now} className="mt-0.5 text-muted-foreground" />
                </span>
              </a>
            </TasteCard>
          </li>
        ))}
      </ul>
    </div>
  )
}
