"use client"

import { MediaImage } from "@/components/ds/media-image"
import { CopOrDrop } from "@/components/votes/cop-or-drop"
import type { FeedItem } from "@/lib/feed/types"
import { altOf, focusOf } from "@/lib/images/curate"
import { youtubeCrop } from "@/lib/images/youtube-crop"

/**
 * The issue's last word, after The Scene: one fit or grail it hasn't shown
 * yet, and a vote. Unnumbered, like the cover and the back page.
 */
export function CopOrDropBlock({ item }: { item: FeedItem }) {
  if (!item.imageUrl) return null
  return (
    <section aria-labelledby="issue-cop-or-drop" className="scroll-mt-20">
      <header className="mb-5 border-t border-foreground/80 pt-3">
        <p className="text-caption font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Last word
        </p>
        <h3
          id="issue-cop-or-drop"
          className="mt-1 font-serif text-[36px] leading-none italic md:text-[48px]"
        >
          Cop or Drop
        </h3>
      </header>
      <figure className="mx-auto max-w-sm">
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted">
          <MediaImage
            src={item.imageUrl}
            alt={altOf(item)}
            focus={focusOf(item)}
            sizes="(min-width: 768px) 384px, 90vw"
            // A Short's thumbnail is mostly blurred side bars: zoom to the video.
            className={youtubeCrop(item.imageUrl, {
              short: item.meta.short === true,
              frame: "portrait",
            })}
          />
        </div>
        <figcaption className="mt-3 text-center">
          <p className="line-clamp-2 text-callout font-semibold">{item.title}</p>
          {item.subtitle ? (
            <p className="mt-0.5 line-clamp-1 text-footnote text-muted-foreground">
              {item.subtitle}
            </p>
          ) : null}
        </figcaption>
        <CopOrDrop item={item} className="mt-3" />
      </figure>
    </section>
  )
}
