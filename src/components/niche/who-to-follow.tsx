"use client"

import { ArrowUpRight } from "lucide-react"
import { useState } from "react"
import { BrandSheet } from "@/components/brand/brand-sheet"
import { MediaImage } from "@/components/ds/media-image"
import { type FollowCard, instagramUrl } from "@/lib/social/follow"
import { ArtistSheet } from "./artists-row"

/**
 * The people and labels that define the scene, as profile cards. Tapping a
 * card opens it here; "Instagram" is the small way out. Every handle was
 * verified (see scripts/verify-instagram.ts).
 */
export function WhoToFollow({ cards }: { cards: readonly FollowCard[] }) {
  const [open, setOpen] = useState<FollowCard | null>(null)
  if (cards.length === 0) return null
  return (
    <section aria-label="Who to follow">
      <p className="mb-3 text-overline font-medium text-muted-foreground uppercase">
        Who to follow
      </p>
      <ul className="-mx-(--gutter) no-scrollbar flex gap-3 overflow-x-auto px-(--gutter) pb-1">
        {cards.map((card) => (
          <li
            key={`${card.kind}:${card.slug}`}
            className="flex w-36 shrink-0 flex-col items-center rounded-2xl border border-border p-3 text-center"
          >
            <button
              type="button"
              onClick={() => setOpen(card)}
              className="group flex w-full flex-col items-center"
              aria-label={`${card.name} (${card.kind})`}
            >
              <span className="relative size-16 overflow-hidden rounded-full bg-muted">
                {card.imageUrl ? (
                  <MediaImage src={card.imageUrl} alt="" sizes="64px" />
                ) : (
                  <span className="grid size-full place-items-center font-serif text-title-3 italic">
                    {card.name.charAt(0)}
                  </span>
                )}
              </span>
              <span className="mt-2 block w-full truncate text-footnote font-semibold group-hover:underline">
                {card.name}
              </span>
              <span className="block w-full truncate text-caption text-muted-foreground">
                @{card.handle}
              </span>
            </button>
            <a
              href={instagramUrl(card.handle)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${card.name} on Instagram (opens in a new tab)`}
              className="mt-2 inline-flex h-7 items-center gap-0.5 rounded-full border border-border px-2.5 text-caption font-medium text-muted-foreground hover:text-foreground"
            >
              Instagram
              <ArrowUpRight aria-hidden className="size-3" strokeWidth={1.75} />
            </a>
          </li>
        ))}
      </ul>
      {open?.kind === "artist" ? (
        <ArtistSheet
          artist={{ slug: open.slug, name: open.name, imageUrl: open.imageUrl }}
          onClose={() => setOpen(null)}
        />
      ) : open ? (
        <BrandSheet brand={{ slug: open.slug, name: open.name }} onClose={() => setOpen(null)} />
      ) : null}
    </section>
  )
}
