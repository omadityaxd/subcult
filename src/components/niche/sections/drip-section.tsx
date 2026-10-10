"use client"

import { ArrowUpRight, ShoppingBag } from "lucide-react"
import { type CSSProperties, useState } from "react"
import { ResponsiveSheet } from "@/components/ds/responsive-sheet"
import type { NicheBrand } from "@/lib/engine/profile-schema"
import { type ShopConfig, storeLinks } from "@/lib/links"
import { SectionHeading } from "../link-card"

interface DripSectionProps {
  brands: readonly NicheBrand[]
  shopKeywords: readonly string[]
  shopConfig: ShopConfig
  themeStyle: CSSProperties
}

type ShopTarget = { query: string; title: string; description: string }

const TIER_LABEL = { $: "budget", $$: "mid", $$$: "splurge" } as const

/** Brand cards + "fit inspo" pieces; tapping either opens a sheet of store searches. */
export function DripSection({ brands, shopKeywords, shopConfig, themeStyle }: DripSectionProps) {
  const [target, setTarget] = useState<ShopTarget | null>(null)

  return (
    <div className="space-y-8">
      <section>
        <SectionHeading>the brands</SectionHeading>
        <ul className="grid grid-cols-2 gap-3">
          {brands.map((brand) => (
            <li key={brand.name}>
              <button
                type="button"
                onClick={() =>
                  setTarget({
                    query: brand.name,
                    title: brand.name,
                    description: brand.why,
                  })
                }
                className="flex h-full w-full flex-col rounded-2xl bg-card p-4 text-left transition-transform active:scale-[0.97]"
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-display text-[17px] leading-tight font-semibold">
                    {brand.name}
                  </span>
                  <span
                    className="shrink-0 rounded-full bg-niche/15 px-2 py-0.5 text-[12px] font-semibold text-niche"
                    title={TIER_LABEL[brand.priceTier]}
                  >
                    {brand.priceTier}
                    <span className="sr-only"> ({TIER_LABEL[brand.priceTier]})</span>
                  </span>
                </span>
                <span className="mt-2 line-clamp-3 text-[13px] text-muted-foreground">
                  {brand.why}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeading>fit inspo 🛍️</SectionHeading>
        <ul className="flex flex-wrap gap-2">
          {shopKeywords.map((keyword) => (
            <li key={keyword}>
              <button
                type="button"
                onClick={() =>
                  setTarget({
                    query: keyword,
                    title: `where to cop: ${keyword}`,
                    description: "new, secondhand or vintage. your call.",
                  })
                }
                className="flex items-center gap-1.5 rounded-full bg-card px-4 py-2.5 text-[15px] font-medium transition-transform active:scale-95"
              >
                <ShoppingBag aria-hidden className="size-4 text-niche" />
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
          <ul className="space-y-2">
            {storeLinks(target.query, shopConfig).map((store) => (
              <li key={store.id}>
                <a
                  href={store.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-2xl bg-card px-4 py-3 transition-transform active:scale-[0.98]"
                >
                  <span>
                    <span className="block text-[16px] font-semibold">{store.label}</span>
                    <span className="block text-[13px] text-muted-foreground">{store.blurb}</span>
                  </span>
                  <ArrowUpRight aria-hidden className="size-4 text-muted-foreground" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </ResponsiveSheet>
    </div>
  )
}
