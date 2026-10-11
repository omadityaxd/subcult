"use client"

import { ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import type { BrandSheetData } from "@/app/api/brands/[slug]/route"
import { NicheAvatar } from "@/components/ds/niche-avatar"
import { ResponsiveSheet } from "@/components/ds/responsive-sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { MediaImage } from "@/components/ds/media-image"
import { PinSheet } from "@/components/moodboard/pin-sheet"
import { type ArtistRef, ArtistSheet } from "@/components/niche/artists-row"
import { ProductTile } from "@/components/shop/product-card"
import type { ProductRef } from "@/components/shop/product-sheet"
import type { Pin } from "@/lib/moodboard/types"
import { formatPrice } from "@/lib/shop/archive"
import type { ApiResponse } from "@/lib/request"

export interface BrandRef {
  slug: string
  name: string
}

/** A brand as a first-class entity: what it is, where it lives in the scene. */
export function BrandSheet({ brand, onClose }: { brand: BrandRef; onClose: () => void }) {
  const [data, setData] = useState<BrandSheetData | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/brands/${brand.slug}`)
      .then((response) => response.json() as Promise<ApiResponse<BrandSheetData>>)
      .then((body) => {
        if (cancelled) return
        if (body.success) setData(body.data)
        else setFailed(true)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [brand.slug])

  return (
    <ResponsiveSheet
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={brand.name}
    >
      {!data && !failed ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      ) : data ? (
        <>
          <p className="text-body leading-relaxed text-muted-foreground">
            {data.brand.description}
          </p>
          {data.niches.length > 0 ? (
            <>
              <p className="mt-6 mb-3 text-overline font-medium text-muted-foreground uppercase">
                Worn in
              </p>
              <ul className="flex flex-wrap gap-2">
                {data.niches.map((niche) => (
                  <li key={niche.slug}>
                    <Link
                      href={`/n/${niche.slug}`}
                      onClick={onClose}
                      className="flex h-10 items-center gap-2 rounded-full border border-border-strong py-1 pr-4 pl-1 text-footnote font-medium hover:bg-muted"
                    >
                      <NicheAvatar
                        slug={niche.slug}
                        name={niche.name}
                        palette={niche.palette}
                        imageUrl={niche.imageUrl}
                        size="xs"
                        className="p-0"
                      />
                      {niche.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <BrandExtras data={data} />
          {data.brand.officialUrl ? (
            <a
              href={data.brand.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-0.5 text-caption font-medium text-muted-foreground hover:text-foreground"
            >
              Official site
              <ArrowUpRight aria-hidden className="size-3" strokeWidth={1.75} />
            </a>
          ) : null}
        </>
      ) : (
        <p className="text-callout text-muted-foreground">
          This brand didn&apos;t load. Try again.
        </p>
      )}
    </ResponsiveSheet>
  )
}

function BrandExtras({ data }: { data: BrandSheetData }) {
  const [artist, setArtist] = useState<ArtistRef | null>(null)
  const [pin, setPin] = useState<Pin | null>(null)
  const listings = (data.archive?.eras ?? [])
    .flatMap((era) => era.listings)
    .sort((a, b) => Number(b.grail) - Number(a.grail) || b.price - a.price)
    .slice(0, 12)
  const products: ProductRef[] = listings.map((listing) => ({
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
  }))

  return (
    <>
      {data.artists.length > 0 ? (
        <>
          <p className="mt-6 mb-3 text-overline font-medium text-muted-foreground uppercase">
            Seen on
          </p>
          <ul className="space-y-2">
            {data.artists.map((entry) => (
              <li key={entry.slug} className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setArtist({ slug: entry.slug, name: entry.name, imageUrl: entry.imageUrl })
                  }
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left hover:bg-muted"
                >
                  <span className="relative size-11 shrink-0 overflow-hidden rounded-full bg-muted">
                    {entry.imageUrl ? (
                      <MediaImage src={entry.imageUrl} alt="" sizes="44px" />
                    ) : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-callout font-semibold">{entry.name}</span>
                    <span className="block truncate text-footnote text-muted-foreground">
                      {entry.note}
                    </span>
                  </span>
                </button>
                <a
                  href={entry.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-caption text-muted-foreground hover:text-foreground"
                >
                  Source
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {products.length > 0 ? (
        <>
          <div className="mt-6 mb-3 flex items-baseline justify-between gap-3">
            <p className="text-overline font-medium text-muted-foreground uppercase">
              Live archive
            </p>
            {data.archive?.priceRange ? (
              <span className="text-caption text-muted-foreground tabular-nums">
                {formatPrice(data.archive.priceRange.min, data.archive.priceRange.currency)} –{" "}
                {formatPrice(data.archive.priceRange.max, data.archive.priceRange.currency)}
              </span>
            ) : null}
          </div>
          <ul className="-mx-1 no-scrollbar flex gap-3 overflow-x-auto px-1 pb-1">
            {products.map((product) => (
              <li key={product.listingId} className="w-36 shrink-0">
                <ProductTile product={product} similar={products} />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {data.board.length > 0 ? (
        <>
          <p className="mt-6 mb-3 text-overline font-medium text-muted-foreground uppercase">
            Moodboard
          </p>
          <ul className="grid grid-cols-3 gap-2">
            {data.board.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => setPin(entry)}
                  aria-label={entry.title ?? "Open image"}
                  className="relative block aspect-square w-full overflow-hidden rounded-xl bg-muted"
                >
                  <MediaImage src={entry.imageUrl} alt="" sizes="120px" />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {artist ? <ArtistSheet artist={artist} onClose={() => setArtist(null)} /> : null}
      {pin ? (
        <PinSheet
          key={pin.id}
          pin={pin}
          pins={data.board}
          pinterestQuery={data.brand.name}
          onOpen={setPin}
          onClose={() => setPin(null)}
        />
      ) : null}
    </>
  )
}
