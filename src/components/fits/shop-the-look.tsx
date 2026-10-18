"use client"

import { ShoppingBag } from "lucide-react"
import { useState } from "react"
import { MediaImage } from "@/components/ds/media-image"
import { type ProductRef, ProductSheet } from "@/components/shop/product-sheet"
import type { LookListing } from "@/app/api/shop/look/route"
import type { ApiResponse } from "@/lib/request"
import { formatPrice } from "@/lib/shop/archive"

const toRef = (listing: LookListing): ProductRef => ({
  listingId: listing.id,
  title: listing.title,
  brand: listing.brand,
  price: listing.price,
  currency: listing.currency,
  imageUrl: listing.imageUrl,
  url: listing.url,
  condition: listing.condition,
  era: null,
  season: null,
  grail: false,
  brandSlug: listing.brandSlug,
})

type State = { kind: "idle" } | { kind: "loading" } | { kind: "ready"; items: ProductRef[] }

/** "Shop the look": live eBay listings for the brands tagged on a fit, opened in-app. */
export function ShopTheLook({ brands }: { brands: readonly { slug: string; name: string }[] }) {
  const [state, setState] = useState<State>({ kind: "idle" })
  const [open, setOpen] = useState<ProductRef | null>(null)
  if (brands.length === 0) return null

  if (state.kind === "idle") {
    return (
      <button
        type="button"
        onClick={async () => {
          setState({ kind: "loading" })
          const params = new URLSearchParams({
            brands: brands
              .slice(0, 4)
              .map((b) => b.slug)
              .join(","),
          })
          const body = (await fetch(`/api/shop/look?${params}`)
            .then((r) => r.json())
            .catch(() => null)) as ApiResponse<{ listings: LookListing[] }> | null
          setState({ kind: "ready", items: body?.success ? body.data.listings.map(toRef) : [] })
        }}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground text-callout font-semibold text-background"
      >
        <ShoppingBag aria-hidden className="size-4" strokeWidth={1.75} />
        Shop the look
      </button>
    )
  }
  if (state.kind === "loading") {
    return <p className="mt-4 text-center text-footnote text-muted-foreground">Finding pieces…</p>
  }
  if (state.items.length === 0) {
    return (
      <p className="mt-4 text-center text-footnote text-muted-foreground">
        No live listings for {brands.map((b) => b.name).join(", ")} right now.
      </p>
    )
  }
  return (
    <section className="mt-6">
      <p className="mb-2 text-caption font-semibold tracking-[0.15em] text-muted-foreground uppercase">
        Shop the look
      </p>
      <ul className="grid grid-cols-3 gap-2">
        {state.items.map((item) => (
          <li key={item.listingId}>
            <button type="button" onClick={() => setOpen(item)} className="block w-full text-left">
              <span className="relative block aspect-square overflow-hidden rounded-xl bg-muted">
                {item.imageUrl ? <MediaImage src={item.imageUrl} alt="" sizes="120px" /> : null}
              </span>
              <span className="mt-1 block truncate text-caption text-muted-foreground">
                {item.brand}
              </span>
              <span className="block text-footnote font-semibold">
                {formatPrice(item.price, item.currency)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open ? (
        <ProductSheet
          product={open}
          similar={state.items}
          onOpen={setOpen}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </section>
  )
}
