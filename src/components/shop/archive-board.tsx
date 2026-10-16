"use client"

import { useState } from "react"
import { BrandSheet } from "@/components/brand/brand-sheet"
import { type BrandArchive, formatPrice } from "@/lib/shop/archive"
import type { ProductRef } from "./product-sheet"
import { ProductTile } from "./product-card"

const toRef = (
  listing: BrandArchive["eras"][number]["listings"][number],
  brandSlug: string,
): ProductRef => ({
  listingId: listing.id,
  title: listing.title,
  brand: listing.brand,
  price: listing.price,
  currency: listing.currency,
  imageUrl: listing.imageUrl,
  url: listing.url,
  condition: listing.condition,
  era: listing.era,
  season: listing.season,
  grail: listing.grail,
  brandSlug,
})

/** Archive tab: live listings grouped by brand, then era, with price ranges and grails. */
export function ArchiveBoard({ archives }: { archives: readonly BrandArchive[] }) {
  const [brand, setBrand] = useState<{ slug: string; name: string } | null>(null)
  return (
    <div className="space-y-12">
      {archives.map((archive) => {
        const all = archive.eras
          .flatMap((era) => era.listings)
          .map((listing) => toRef(listing, archive.brandSlug))
        return (
          <section key={archive.brandSlug} aria-label={archive.brand}>
            <header className="mb-4 flex items-end justify-between gap-3">
              <button
                type="button"
                onClick={() => setBrand({ slug: archive.brandSlug, name: archive.brand })}
                className="text-left"
              >
                <span className="block font-serif text-title-1 leading-none italic hover:underline">
                  {archive.brand}
                </span>
              </button>
              {archive.priceRange ? (
                <span className="text-footnote text-muted-foreground tabular-nums">
                  {formatPrice(archive.priceRange.min, archive.priceRange.currency)} –{" "}
                  {formatPrice(archive.priceRange.max, archive.priceRange.currency)}
                </span>
              ) : null}
            </header>
            <div className="space-y-6">
              {archive.eras.map((group) => (
                <div key={group.era ?? "undated"}>
                  <p className="mb-2 text-overline font-medium text-muted-foreground uppercase">
                    {group.era ?? "Undated"}
                  </p>
                  <ul className="-mx-(--gutter) no-scrollbar flex gap-3 overflow-x-auto px-(--gutter) pb-1">
                    {group.listings.map((listing) => (
                      <li key={listing.id} className="w-40 shrink-0 sm:w-48">
                        <ProductTile product={toRef(listing, archive.brandSlug)} similar={all} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )
      })}
      <p className="text-caption text-muted-foreground">
        Live eBay listings, refreshed every few hours. Eras come from how sellers date their pieces;
        grails are a brand&apos;s top price tier right now, or runway and sample pieces.
      </p>
      {brand ? <BrandSheet brand={brand} onClose={() => setBrand(null)} /> : null}
    </div>
  )
}
