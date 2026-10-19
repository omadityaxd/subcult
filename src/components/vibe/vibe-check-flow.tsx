"use client"

import { useState } from "react"
import type { ApiResponse } from "@/lib/request"
import type { DeckCard, MixNiche } from "@/lib/vibe/data"
import { type Answer, type Blurbs, scoreVibe, templateBlurb, topMix } from "@/lib/vibe/score"
import { eraShift } from "@/lib/vibe/era"
import { saveVibeResult, useVibeResult } from "@/lib/vibe/storage"
import { recordVibeCheck } from "@/lib/taste/store"
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
}

/**
 * Deck → result. The template blurb shows instantly; if the server has an
 * Anthropic key and budget, a personalized one replaces it.
 */
export function VibeCheckFlow({ cards, seed, niches, blurbs }: VibeCheckFlowProps) {
  const [result, setResult] = useState<{
    mix: MixNiche[]
    blurb: string
    shift: string | null
  } | null>(null)
  const [round, setRound] = useState(0)
  const previous = useVibeResult()

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
      <VibeResult mix={result.mix} blurb={result.blurb} shift={result.shift} onRetake={retake} />
    )
  }
  return (
    <div className="mx-auto h-full w-full max-w-md px-4 pb-6 md:pt-6">
      <VibeDeck key={round} pool={cards} seed={seed + round * 7919} onComplete={finish} />
    </div>
  )
}
