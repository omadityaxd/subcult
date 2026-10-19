"use client"

import { useState } from "react"
import { MediaImage } from "@/components/ds/media-image"
import { type ProductRef, ProductSheet } from "@/components/shop/product-sheet"
import { feedItemProduct } from "@/components/shop/product-card"
import { TasteCard } from "@/components/taste/taste-card"
import { CopOrDrop } from "@/components/votes/cop-or-drop"
import type { FeedItem } from "@/lib/feed/types"
import { formatPrice } from "@/lib/shop/archive"

/** The "grail" stamp: rare or high-value pieces only (the archive's own flag). */
function GrailStamp() {
  return (
    <span
      aria-label="Grail"
      className="absolute top-3 right-3 grid size-14 -rotate-12 place-items-center rounded-full border-2 border-current text-[0.625rem] font-bold tracking-[0.2em] text-foreground uppercase"
    >
      Grail
    </span>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border-strong px-2 py-0.5 text-caption font-medium">
      {children}
    </span>
  )
}

/**
 * The Grail as a product catalogue: the piece on a neutral backdrop (whole
 * item, not cropped to fill), price set large, condition and era chips.
 */
export function GrailCatalog({ items }: { items: readonly FeedItem[] }) {
  const products = items.map(feedItemProduct)
  const [open, setOpen] = useState<ProductRef | null>(null)
  return (
    <>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6">
        {items.map((item) => {
          const product = feedItemProduct(item)
          return (
            <li key={item.id}>
              <TasteCard item={item} niche={null} reason={null}>
                <button
                  type="button"
                  onClick={() => setOpen(product)}
                  aria-label={`${product.title}, ${formatPrice(product.price, product.currency)}`}
                  className="group block w-full text-left"
                >
                  <span className="relative block aspect-square overflow-hidden rounded-2xl bg-[#ecebe8] transition-transform group-active:scale-[0.98] dark:bg-[#1c1c1b]">
                    {product.imageUrl ? (
                      <MediaImage
                        src={product.imageUrl}
                        alt=""
                        sizes="(max-width: 768px) 50vw, 280px"
                        className="object-contain p-4 mix-blend-multiply dark:mix-blend-normal"
                      />
                    ) : null}
                    {product.grail ? <GrailStamp /> : null}
                  </span>
                  <span className="mt-3 block truncate text-caption font-semibold tracking-[0.15em] text-muted-foreground uppercase">
                    {product.brand}
                  </span>
                  <span className="mt-0.5 block font-serif text-[28px] leading-none tabular-nums md:text-[32px]">
                    {formatPrice(product.price, product.currency)}
                  </span>
                  <span className="mt-1 line-clamp-1 block text-footnote text-muted-foreground">
                    {product.title}
                  </span>
                  {product.condition || product.season || product.era ? (
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {product.condition ? <Chip>{product.condition}</Chip> : null}
                      {product.season || product.era ? (
                        <Chip>{product.season ?? product.era}</Chip>
                      ) : null}
                    </span>
                  ) : null}
                </button>
                <CopOrDrop item={item} className="mt-3" />
              </TasteCard>
            </li>
          )
        })}
      </ul>
      {open ? (
        <ProductSheet
          key={open.listingId}
          product={open}
          similar={products}
          onOpen={setOpen}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  )
}
