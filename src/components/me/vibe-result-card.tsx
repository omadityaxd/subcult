"use client"

import { ArrowRight } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { Cover } from "@/components/ds/cover"
import { encodeMix } from "@/lib/vibe/score"
import { useVibeResult } from "@/lib/vibe/storage"

export interface CardNiche {
  name: string
  palette: readonly string[]
}

interface VibeResultCardProps {
  niches: Readonly<Record<string, CardNiche>>
  /** Shown until there's a result on this device (the "not decoded yet" teaser). */
  fallback: ReactNode
}

/** Your latest Vibe Check on Me: the mix, the blurb, and a link to the full result. */
export function VibeResultCard({ niches, fallback }: VibeResultCardProps) {
  const result = useVibeResult()
  const mix = result?.mix.filter((entry) => niches[entry.slug]) ?? []
  if (!result || mix.length === 0) return <>{fallback}</>
  const top = niches[mix[0].slug]

  return (
    <Link href={`/vibe-check/r/${encodeMix(mix)}`} className="group block">
      <Cover
        palette={top.palette}
        seed={`vibe-${mix[0].slug}`}
        className="relative flex flex-col gap-5 rounded-3xl p-6 text-white md:p-8"
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-3xl bg-gradient-to-b from-black/30 to-black/60"
        />
        <span className="relative text-overline font-medium text-white/75 uppercase">
          Your niche mix
        </span>
        <span className="relative font-serif text-title-1 leading-none italic">
          {mix[0].percent}% {top.name}
        </span>
        <ul className="relative space-y-2">
          {mix.map((entry) => (
            <li key={entry.slug} className="flex items-center gap-3 text-callout">
              <span className="w-28 truncate">{niches[entry.slug].name}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${entry.percent}%`,
                    backgroundColor: niches[entry.slug].palette[3],
                  }}
                />
              </span>
              <span className="w-10 text-right tabular-nums">{entry.percent}%</span>
            </li>
          ))}
        </ul>
        <span className="relative max-w-xl text-callout text-white/85">{result.blurb}</span>
        <span className="relative inline-flex items-center gap-1.5 text-callout font-semibold">
          See your result
          <ArrowRight
            aria-hidden
            className="size-4 transition-transform group-hover:translate-x-0.5"
            strokeWidth={1.75}
          />
        </span>
      </Cover>
    </Link>
  )
}
