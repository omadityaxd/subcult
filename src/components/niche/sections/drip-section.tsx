"use client"

import { ArrowUpRight, Plus } from "lucide-react"
import { type CSSProperties, useState } from "react"
import { BrandSheet } from "@/components/brand/brand-sheet"
import { ResponsiveSheet } from "@/components/ds/responsive-sheet"
import { SectionHeader } from "@/components/ds/section-header"
import type { NicheBrand } from "@/lib/engine/profile-schema"
import { type ExtraStoreId, type ShopConfig, brandLinks, storeLinks } from "@/lib/links"

interface DripSectionProps {
  brands: readonly NicheBrand[]
  shopKeywords: readonly string[]
  shopConfig: ShopConfig
  themeStyle: CSSProperties
  /** Designer resale (SSENSE, Vestiaire) for archive and designer niches. */
  extraStores?: readonly ExtraStoreId[]
  /**
   * Brands the taxonomy knows, by display name → verified official site (or
   * null). These link to the official site + resale only, never marketplaces.
   */
  brandSites?: Readonly<Record<string, string | null>>
  /** Brands the taxonomy knows (display name → slug) open their in-app brand sheet. */
  brandSlugs?: Readonly<Record<string, string>>
}

type ShopTarget = { query: string; title: string; description: string; brand?: boolean }

const TIER_LABEL = { $: "Budget", $$: "Mid", $$$: "Splurge" } as const

/** Brands and pieces; tapping either opens store searches (sheet on phones, modal on desktop). */
export function DripSection({
  brands,
  shopKeywords,
  shopConfig,
  themeStyle,
  extraStores = [],
  brandSites = {},
  brandSlugs = {},
}: DripSectionProps) {
  const [target, setTarget] = useState<ShopTarget | null>(null)
  const [brandSheet, setBrandSheet] = useState<{ slug: string; name: string } | null>(null)

  return (
    <div className="space-y-12">
      <section>
        <SectionHeader overline="Who makes the look" title="Brands" />
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {brands.map((brand) => (
            <li key={brand.name}>
              <button
                type="button"
                onClick={() =>
                  brandSlugs[brand.name]
                    ? setBrandSheet({ slug: brandSlugs[brand.name], name: brand.name })
                    : setTarget({
                        query: brand.name,
                        title: brand.name,
                        description: brand.why,
                        brand: true,
                      })
                }
                className="flex h-full w-full flex-col rounded-2xl border border-border bg-card p-5 text-left transition-[transform,background-color] duration-200 hover:bg-muted active:scale-[0.98]"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-serif text-title-3 italic">{brand.name}</span>
                  <span
                    className="text-footnote text-muted-foreground tabular-nums"
                    title={TIER_LABEL[brand.priceTier]}
                  >
                    {brand.priceTier}
                    <span className="sr-only"> ({TIER_LABEL[brand.priceTier]})</span>
                  </span>
                </span>
                <span className="mt-2 text-callout text-muted-foreground">{brand.why}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeader title="The pieces" />
        <ul className="flex flex-wrap gap-2">
          {shopKeywords.map((keyword) => (
            <li key={keyword}>
              <button
                type="button"
                onClick={() =>
                  setTarget({
                    query: keyword,
                    title: keyword,
                    description: "New, secondhand or vintage. Your call.",
                  })
                }
                className="inline-flex h-10 items-center gap-2 rounded-full border border-border-strong px-4 text-callout font-medium transition-colors first-letter:uppercase hover:bg-muted"
              >
                <Plus aria-hidden className="size-4 text-muted-foreground" strokeWidth={1.5} />
                {keyword}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <ResponsiveSheet
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null)
        }}
        title={target?.title ?? ""}
        description={target?.description}
        themeStyle={themeStyle}
      >
        {target ? (
          <ul className="divide-y divide-border">
            {(target.brand && target.query in brandSites
              ? brandLinks(target.query, brandSites[target.query] ?? null)
              : storeLinks(target.query, shopConfig, extraStores)
            ).map((store) => (
              <li key={store.id}>
                <a
                  href={store.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between gap-4 py-3.5"
                >
                  <span>
                    <span className="block text-headline font-semibold">{store.label}</span>
                    <span className="block text-footnote text-muted-foreground">{store.blurb}</span>
                  </span>
                  <ArrowUpRight
                    aria-hidden
                    strokeWidth={1.5}
                    className="size-[18px] text-muted-foreground transition-transform group-hover:-translate-y-0.5"
                  />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </ResponsiveSheet>
      {brandSheet ? <BrandSheet brand={brandSheet} onClose={() => setBrandSheet(null)} /> : null}
    </div>
  )
}
