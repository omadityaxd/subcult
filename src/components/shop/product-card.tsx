"use client"

import { useState } from "react"
import { MediaImage } from "@/components/ds/media-image"
import type { FeedItem } from "@/lib/feed/types"
import { formatPrice } from "@/lib/shop/archive"
import { cn } from "@/lib/utils"
import { GrailBadge, type ProductRef, ProductSheet } from "./product-sheet"

const str = (value: unknown) => (typeof value === "string" ? value : null)

export function feedItemProduct(item: FeedItem): ProductRef {
  return {
    listingId: str(item.meta.listingId) ?? item.id.replace(/^ebay:/, ""),
    title: item.title,
    brand: item.subtitle,
    price: typeof item.meta.price === "number" ? item.meta.price : 0,
    currency: str(item.meta.currency) ?? "USD",
    imageUrl: item.imageUrl,
    url: item.url,
    condition: str(item.meta.condition),
    era: str(item.meta.era),
    season: str(item.meta.season),
    grail: item.meta.grail === true,
  }
}

/** A real listing: photo, price, era; tap for the in-app product sheet. */
export function ProductTile({
  product,
  similar = [],
  className,
}: {
  product: ProductRef
  similar?: readonly ProductRef[]
  className?: string
}) {
  const [open, setOpen] = useState<ProductRef | null>(null)
  return (
    <article className={className}>
      <button
        type="button"
        onClick={() => setOpen(product)}
        aria-label={`${product.title}, ${formatPrice(product.price, product.currency)}`}
        className="group block w-full text-left"
      >
        <span className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-muted transition-transform group-active:scale-[0.98]">
          {product.imageUrl ? (
            <MediaImage src={product.imageUrl} alt="" sizes="(max-width: 640px) 50vw, 25vw" />
          ) : null}
          <span className="absolute top-2 left-2 flex gap-1.5">
            {product.grail ? <GrailBadge /> : null}
            {product.season || product.era ? (
              <span className="rounded-full bg-black/55 px-2 py-0.5 text-[0.6875rem] font-semibold text-white backdrop-blur-md">
                {product.season ?? product.era}
              </span>
            ) : null}
          </span>
        </span>
        <span className="mt-2 block truncate px-0.5 text-footnote text-muted-foreground">
          {product.brand}
        </span>
        <span className={cn("block px-0.5 text-callout font-semibold")}>
          {formatPrice(product.price, product.currency)}
        </span>
      </button>
      {open ? (
        <ProductSheet
          key={open.listingId}
          product={open}
          similar={similar}
          onOpen={setOpen}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </article>
  )
}

export function ProductCard({ item }: { item: FeedItem }) {
  return <ProductTile product={feedItemProduct(item)} />
}
