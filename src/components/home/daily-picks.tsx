"use client"

import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { BrandSheet } from "@/components/brand/brand-sheet"
import { MediaImage } from "@/components/ds/media-image"
import { PinSheet } from "@/components/moodboard/pin-sheet"
import { ProductCard } from "@/components/shop/product-card"
import type { FeedItem } from "@/lib/feed/types"
import type { DailyPicks as Picks } from "@/lib/feed/daily"
import type { Pin } from "@/lib/moodboard/types"

/**
 * For You leads with visuals: the look of the day (a real image from a
 * fashion niche's board, credited) and a brand spotlight. The archive grail
 * slots in next to them once live listings are available.
 */
export function DailyPicks({
  look,
  brand,
  grail,
}: Pick<Picks, "look" | "brand"> & { grail?: React.ReactNode }) {
  const [openPin, setOpenPin] = useState<Pin | null>(null)
  const [brandOpen, setBrandOpen] = useState(false)
  if (!look && !brand && !grail) return null

  return (
    <section aria-label="Today" className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      {look ? (
        <article className="md:row-span-2">
          <button
            type="button"
            onClick={() => setOpenPin(look.pin)}
            aria-label={`Look of the day: ${look.pin.title ?? look.niche.name}`}
            className="group relative block aspect-[4/5] w-full overflow-hidden rounded-3xl bg-muted active:scale-[0.99]"
            style={{ backgroundColor: look.pin.color ?? undefined }}
          >
            <MediaImage
              src={look.pin.largeUrl}
              alt=""
              sizes="(max-width: 768px) 100vw, 60vw"
              priority
              className="transition-transform duration-700 group-hover:scale-[1.02]"
            />
            <span
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"
            />
            <span className="absolute inset-x-5 bottom-5 text-left text-white">
              <span className="block text-overline font-medium uppercase opacity-80">
                Look of the day
              </span>
              <span className="mt-1 block font-serif text-title-1 leading-none italic">
                {look.niche.name}
              </span>
              {look.pin.credit ? (
                <span className="mt-2 block truncate text-caption opacity-75">
                  {look.pin.credit.label}
                </span>
              ) : null}
            </span>
          </button>
        </article>
      ) : null}

      {grail}

      {brand ? (
        <article className="flex flex-col justify-between rounded-3xl bg-foreground p-6 text-background">
          <div>
            <p className="text-overline font-medium uppercase opacity-70">Brand spotlight</p>
            <p className="mt-2 font-serif text-title-1 leading-none italic">{brand.brand.name}</p>
            <p className="mt-3 line-clamp-3 text-callout opacity-80">{brand.brand.description}</p>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setBrandOpen(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-background px-4 text-callout font-semibold text-foreground active:scale-[0.97]"
            >
              Open brand
              <ArrowRight aria-hidden className="size-4" strokeWidth={1.75} />
            </button>
            {brand.niches.slice(0, 3).map((niche) => (
              <Link
                key={niche.slug}
                href={`/n/${niche.slug}`}
                className="inline-flex h-8 items-center rounded-full border border-background/30 px-3 text-footnote font-medium hover:bg-background/10"
              >
                {niche.name}
              </Link>
            ))}
          </div>
        </article>
      ) : null}

      {openPin && look ? (
        <PinSheet
          key={openPin.id}
          pin={openPin}
          pins={[look.pin]}
          pinterestQuery={null}
          onOpen={setOpenPin}
          onClose={() => setOpenPin(null)}
        />
      ) : null}
      {brandOpen && brand ? (
        <BrandSheet
          brand={{ slug: brand.brand.slug, name: brand.brand.name }}
          onClose={() => setBrandOpen(false)}
        />
      ) : null}
    </section>
  )
}

/** "Archive grail of the day": one real live listing, tap for the product sheet. */
export function GrailOfTheDay({ item }: { item: FeedItem }) {
  return (
    <article className="rounded-3xl border border-border p-4">
      <p className="mb-3 text-overline font-medium text-muted-foreground uppercase">
        Archive grail of the day
      </p>
      <div className="max-w-56">
        <ProductCard item={item} />
      </div>
    </article>
  )
}
