"use client"

import { ArrowRight, Sparkles } from "lucide-react"
import Link from "next/link"
import { findPreset } from "@/lib/niches/catalog"
import { recheckDue } from "@/lib/vibe/era"
import { useVibeResult } from "@/lib/vibe/storage"

/** The issue's weekly "re-check your era" card (or the first vibe check, if never taken). */
export function EraRecheck({ now }: { now: number }) {
  const result = useVibeResult()
  if (!recheckDue(result?.takenAt ?? null, now)) return null
  const top = result?.mix[0]
  const name = top ? (findPreset(top.slug)?.name ?? top.slug) : null
  return (
    <Link
      href="/vibe-check"
      data-testid="era-recheck"
      className="group flex items-center gap-4 rounded-3xl border border-border-strong p-5 transition-colors hover:bg-muted md:p-6"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-foreground text-background">
        <Sparkles aria-hidden className="size-5" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-serif text-title-3 italic">
          {name ? "Re-check your era" : "Take the vibe check"}
        </span>
        <span className="block text-footnote text-muted-foreground">
          {name
            ? `Last week you were ${top?.percent}% ${name}. A new deck is waiting.`
            : "10 to 16 swipes. The issue gets more yours."}
        </span>
      </span>
      <ArrowRight
        aria-hidden
        className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5"
        strokeWidth={1.75}
      />
    </Link>
  )
}
