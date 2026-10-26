"use client"

import { ArrowRight, Sparkles } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { recheckDue } from "@/lib/vibe/era"
import { useVibeResult } from "@/lib/vibe/storage"

/** The issue's weekly "re-check your era" card (or the first vibe check, if never taken). */
export function EraRecheck({ now }: { now: number }) {
  const result = useVibeResult()
  const due = recheckDue(result?.takenAt ?? null, now)
  const top = due ? result?.mix[0] : undefined
  const name = useNicheName(top?.slug ?? null)
  if (!due) return null
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

/**
 * The niche's display name. The catalog is large (every niche's queries and
 * artists), so it loads only for the few readers due a re-check, never with
 * the issue; until then the slug stands in.
 */
function useNicheName(slug: string | null): string | null {
  const [loaded, setLoaded] = useState<{ slug: string; name: string } | null>(null)
  useEffect(() => {
    if (!slug) return
    let live = true
    import("@/lib/niches/catalog")
      .then(({ findPreset }) => {
        const name = findPreset(slug)?.name
        if (live && name) setLoaded({ slug, name })
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [slug])
  if (!slug) return null
  return loaded?.slug === slug ? loaded.name : slug.replace(/-/g, " ")
}
