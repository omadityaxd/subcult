"use client"

import { ArrowUpRight } from "lucide-react"
import { useEffect, useState } from "react"
import { MediaImage } from "@/components/ds/media-image"
import { ResponsiveSheet } from "@/components/ds/responsive-sheet"
import { SaveButton } from "@/components/ds/save-button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatPrice } from "@/lib/shop/archive"
import type { ListingDetail } from "@/lib/shop/ebay"
import type { ApiResponse } from "@/lib/request"

export interface ProductRef {
  listingId: string
  title: string
  brand: string | null
  price: number
  currency: string
  imageUrl: string | null
  url: string
  condition: string | null
  era: string | null
  season: string | null
  grail: boolean
}

/**
 * In-app product sheet: gallery, price, condition, size, similar pieces,
 * save. The only step that leaves subcult is "Buy on eBay".
 */
export function ProductSheet({
  product,
  similar,
  onOpen,
  onClose,
}: {
  product: ProductRef
  similar: readonly ProductRef[]
  onOpen: (product: ProductRef) => void
  onClose: () => void
}) {
  const [detail, setDetail] = useState<ListingDetail | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/shop/listings/${encodeURIComponent(product.listingId)}`)
      .then((response) => response.json() as Promise<ApiResponse<ListingDetail>>)
      .then((body) => {
        if (cancelled) return
        if (body.success) setDetail(body.data)
        else setFailed(true)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [product.listingId])

  const images = detail?.images.length ? detail.images : product.imageUrl ? [product.imageUrl] : []
  const facts = [
    ["Condition", detail?.condition ?? product.condition],
    ["Size", detail?.size],
    ["Color", detail?.color],
    ["Era", product.season ?? product.era],
    ["Seller", detail?.seller],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]))
  const others = similar.filter((other) => other.listingId !== product.listingId).slice(0, 6)

  return (
    <ResponsiveSheet
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={product.brand ?? "Listing"}
    >
      <ul className="-mx-1 no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto px-1">
        {images.length > 0 ? (
          images.map((src) => (
            <li
              key={src}
              className="relative aspect-[4/5] w-[78%] shrink-0 snap-center overflow-hidden rounded-2xl bg-muted"
            >
              <MediaImage src={src} alt={product.title} sizes="(max-width: 768px) 80vw, 420px" />
            </li>
          ))
        ) : (
          <li className="aspect-[4/5] w-full rounded-2xl bg-muted" />
        )}
      </ul>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-callout leading-snug font-medium">{product.title}</p>
          <p className="mt-1 flex items-center gap-2 text-title-3 font-semibold">
            {formatPrice(detail?.price ?? product.price, detail?.currency ?? product.currency)}
            {product.grail ? <GrailBadge /> : null}
          </p>
        </div>
        <SaveButton
          item={{
            id: `ebay:${product.listingId}`,
            title: product.title,
            url: product.url,
            imageUrl: product.imageUrl,
            source: "ebay",
            subtitle: product.brand,
          }}
          className="size-10 shrink-0 bg-muted"
        />
      </div>

      {!detail && !failed ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ) : facts.length > 0 ? (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-footnote">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <a
        href={detail?.url ?? product.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-foreground text-callout font-semibold text-background active:scale-[0.99]"
      >
        Buy on eBay
        <ArrowUpRight aria-hidden className="size-4" strokeWidth={1.75} />
      </a>
      <p className="mt-2 text-center text-caption text-muted-foreground">
        Live eBay listing. Price and availability can change.
      </p>

      {others.length > 0 ? (
        <>
          <p className="mt-6 mb-2 text-overline font-medium text-muted-foreground uppercase">
            Similar pieces
          </p>
          <ul className="grid grid-cols-3 gap-2">
            {others.map((other) => (
              <li key={other.listingId}>
                <button
                  type="button"
                  onClick={() => onOpen(other)}
                  className="block w-full text-left"
                  aria-label={`${other.title}, ${formatPrice(other.price, other.currency)}`}
                >
                  <span className="relative block aspect-square overflow-hidden rounded-xl bg-muted">
                    {other.imageUrl ? (
                      <MediaImage src={other.imageUrl} alt="" sizes="120px" />
                    ) : null}
                  </span>
                  <span className="mt-1 block text-caption font-semibold">
                    {formatPrice(other.price, other.currency)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </ResponsiveSheet>
  )
}

export function GrailBadge() {
  return (
    <span className="rounded-full bg-niche px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-niche-foreground uppercase">
      Grail
    </span>
  )
}
