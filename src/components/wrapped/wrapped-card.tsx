"use client"

import { Play } from "lucide-react"
import { useMemo, useState } from "react"
import { Cover } from "@/components/ds/cover"
import { buildSlides } from "@/lib/wrapped/slides"
import { summarize } from "@/lib/wrapped/stats"
import { useClientNow } from "@/lib/use-client-now"
import { useWrappedData } from "@/lib/wrapped/store"
import { type WrappedNiche, WrappedStory } from "./wrapped-story"

interface WrappedCardProps {
  niches: Readonly<Record<string, WrappedNiche>>
  /** Verified artist photos by display name (for the top-artists slide). */
  artistImages: Readonly<Record<string, string>>
}

/** Me: this week's mix in one line, and the button that plays your Wrapped. */
export function WrappedCard({ niches, artistImages }: WrappedCardProps) {
  const data = useWrappedData()
  const [open, setOpen] = useState(false)
  const now = useClientNow()
  const summary = useMemo(() => (data && now ? summarize(data, now) : null), [data, now])

  if (!summary || !summary.hasData) {
    return (
      <section className="rounded-3xl border border-dashed border-border-strong p-6">
        <p className="text-overline font-medium text-muted-foreground uppercase">Your Wrapped</p>
        <p className="mt-2 font-serif text-title-2 italic">Builds itself as you go.</p>
        <p className="mt-1 text-callout text-muted-foreground">
          Play a few soundtracks and open some niches. Your top niches, artists and era show up
          here.
        </p>
      </section>
    )
  }

  const lead = summary.topNiches[0]?.slug ?? null
  const palette = (lead && niches[lead]?.palette) || ["#0a0a0a", "#222", "#555", "#aaa", "#eee"]
  const week = summary.week[0]
  const slides = buildSlides(summary, (name) => artistImages[name] ?? null)
  // Nothing played yet: talk about what was discovered, never "0 minutes".
  const minutes = summary.minutesListened > 0 ? `${summary.minutesListened} min listened` : null
  const discovered = `${summary.nichesDiscovered} ${summary.nichesDiscovered === 1 ? "niche" : "niches"} discovered`
  const era = summary.era ? `${niches[summary.era.slug]?.name ?? summary.era.slug} era` : null
  const details = (minutes ? [minutes, discovered, era] : [era]).filter(Boolean).join(" · ")

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="group block w-full text-left">
        <Cover
          palette={palette}
          seed="wrapped-card"
          className="relative flex flex-col gap-4 rounded-3xl p-6 text-white md:p-8"
        >
          <span
            aria-hidden
            className="absolute inset-0 rounded-3xl bg-gradient-to-br from-black/50 to-black/20"
          />
          <span className="relative text-overline font-medium text-white/75 uppercase">
            {minutes ? "Your Wrapped · from what you actually played" : "Your Wrapped"}
          </span>
          <span className="relative font-serif text-title-1 leading-none italic">
            {week
              ? `This week you were ${week.percent}% ${niches[week.slug]?.name ?? week.slug}`
              : minutes
                ? `${summary.minutesListened} minutes, ${summary.nichesDiscovered} niches`
                : discovered.replace(/^./, (c) => c.toUpperCase())}
          </span>
          {details ? <span className="relative text-callout text-white/80">{details}</span> : null}
          <span className="relative inline-flex h-11 w-fit items-center gap-2 rounded-full bg-white px-5 text-callout font-semibold text-black transition-transform group-active:scale-[0.97]">
            <Play aria-hidden className="size-4" fill="currentColor" strokeWidth={0} />
            Play your Wrapped
          </span>
        </Cover>
      </button>
      {open ? (
        <WrappedStory
          slides={slides}
          niches={niches}
          leadNiche={lead}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}
