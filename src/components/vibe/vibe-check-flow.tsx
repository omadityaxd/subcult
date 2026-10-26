"use client"

import { useState } from "react"
import type { ApiResponse } from "@/lib/request"
import type { DeckCard, MixNiche } from "@/lib/vibe/data"
import { type Answer, type Blurbs, scoreVibe, templateBlurb, topMix } from "@/lib/vibe/score"
import { eraShift } from "@/lib/vibe/era"
import { saveVibeResult, useVibeResult } from "@/lib/vibe/storage"
import { hasVibeSignals, recordVibeCheck } from "@/lib/taste/store"
import Link from "next/link"
import { VibeDeck } from "./vibe-deck"
import { VibeResult } from "./vibe-result"
import { track } from "@/lib/analytics"

export interface NicheInfo {
  name: string
  tagline: string
  palette: readonly string[]
  imageUrl: string | null
  branch?: string
}

interface VibeCheckFlowProps {
  /** This session's pool; the deck picks from it adaptively. */
  cards: readonly DeckCard[]
  /** Server-chosen, so the first card renders the same on server and client. */
  seed: number
  /** Every niche the deck can land on. */
  niches: Readonly<Record<string, NicheInfo>>
  blurbs: Blurbs
  /** First run after sign-up: a result from before signing in can be kept. */
  firstRun?: boolean
}

/**
 * Deck → result. The template blurb shows instantly; if the server has an
 * Anthropic key and budget, a personalized one replaces it.
 */
export function VibeCheckFlow({
  cards,
  seed,
  niches,
  blurbs,
  firstRun = false,
}: VibeCheckFlowProps) {
  const [result, setResult] = useState<{
    mix: MixNiche[]
    blurb: string
    shift: string | null
  } | null>(null)
  const [round, setRound] = useState(0)
  const previous = useVibeResult()
  // First run with a result from before signing in: keep it, or retake.
  const [deciding, setDeciding] = useState(true)

  const finish = (steps: readonly { card: DeckCard; answer: Answer }[]) => {
    const answers = Object.fromEntries(steps.map((step) => [step.card.id, step.answer]))
    const shares = topMix(scoreVibe(cards, answers))
    const mix = shares.flatMap((share) => {
      const info = niches[share.slug]
      return info ? [{ ...share, ...info }] : []
    })
    const blurb =
      mix.length > 0
        ? templateBlurb(mix, blurbs, {
            nameOf: (slug) => niches[slug]?.name ?? slug,
            branchOf: (slug) => niches[slug]?.branch,
          })
        : ""
    // Retakes compare with the last result ("your era shifted").
    const shift = eraShift(previous?.mix ?? null, shares, (slug) => niches[slug]?.name ?? slug)
    setResult({ mix, blurb, shift })
    if (mix.length === 0) return
    saveVibeResult({ mix: shares, blurb, takenAt: Date.now() })
    recordVibeCheck(mix)
    track("vibe_check_completed", { top: mix[0]?.slug ?? "" })

    void fetch("/api/vibe-check/blurb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mix: shares }),
    })
      .then((response) => response.json() as Promise<ApiResponse<{ blurb: string | null }>>)
      .then((body) => {
        if (!body.success || !body.data.blurb) return
        const personal = body.data.blurb
        setResult((current) => (current ? { ...current, blurb: personal } : current))
        saveVibeResult({ mix: shares, blurb: personal, takenAt: Date.now() })
      })
      .catch(() => undefined) // The template blurb is already showing.
  }

  const retake = () => {
    setResult(null)
    setRound((value) => value + 1)
  }

  if (firstRun && previous && deciding && !result) {
    return (
      <KeepOrRetake
        mix={previous.mix.map((share) => ({
          ...share,
          name: niches[share.slug]?.name ?? share.slug,
        }))}
        onRetake={() => setDeciding(false)}
      />
    )
  }

  if (result && result.mix.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="font-serif text-title-1 italic">A blank canvas, apparently.</p>
        <p className="mt-2 max-w-sm text-callout text-muted-foreground">
          Nothing landed this time. Swipe right on anything that feels even a little like you.
        </p>
        <button
          type="button"
          onClick={retake}
          className="mt-6 h-12 rounded-full bg-foreground px-6 text-callout font-semibold text-background"
        >
          Try again
        </button>
      </div>
    )
  }
  if (result) {
    return (
      <VibeResult
        mix={result.mix}
        blurb={result.blurb}
        shift={result.shift}
        onRetake={retake}
        firstRun={firstRun}
      />
    )
  }
  return (
    <div className="mx-auto h-full w-full max-w-md px-4 pb-6 md:pt-6">
      <VibeDeck key={round} pool={cards} seed={seed + round * 7919} onComplete={finish} />
    </div>
  )
}

/** "You already took it": keep the guest result (it's already in your taste) or retake. */
function KeepOrRetake({
  mix,
  onRetake,
}: {
  mix: readonly { slug: string; name: string; percent: number }[]
  onRetake: () => void
}) {
  const keep = () => {
    // The result seeds the taste vector; a guest's may predate this device's taste.
    if (!hasVibeSignals()) recordVibeCheck(mix)
    track("vibe_check_kept", { top: mix[0]?.slug ?? "" })
  }
  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col justify-center px-6">
      <p className="text-overline font-medium text-muted-foreground uppercase">Your vibe check</p>
      <h1 className="mt-2 font-serif text-title-1 italic">You already took it</h1>
      <p className="mt-2 text-callout text-muted-foreground">
        From before you signed in. Keep it for your account, or take it again.
      </p>
      <ul className="mt-6 space-y-2">
        {mix.map((niche) => (
          <li
            key={niche.slug}
            className="flex items-baseline justify-between rounded-2xl bg-card px-4 py-3"
          >
            <span className="font-serif text-title-3 italic">{niche.name}</span>
            <span className="text-footnote text-muted-foreground tabular-nums">
              {niche.percent}%
            </span>
          </li>
        ))}
      </ul>
      <Link
        href={`/start?mix=${mix.map((niche) => niche.slug).join(",")}&first=1`}
        onClick={keep}
        className="mt-8 flex h-14 items-center justify-center rounded-2xl bg-foreground text-callout font-semibold text-background"
      >
        Keep this result
      </Link>
      <button
        type="button"
        onClick={onRetake}
        className="mt-3 h-12 rounded-2xl border border-border-strong text-callout font-semibold"
      >
        Retake
      </button>
    </div>
  )
}
