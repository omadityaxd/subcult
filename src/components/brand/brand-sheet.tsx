"use client"

import { ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import type { BrandSheetData } from "@/app/api/brands/[slug]/route"
import { NicheAvatar } from "@/components/ds/niche-avatar"
import { ResponsiveSheet } from "@/components/ds/responsive-sheet"
import { Skeleton } from "@/components/ui/skeleton"
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
