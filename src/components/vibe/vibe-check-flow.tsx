"use client"

import { useState } from "react"
import type { ApiResponse } from "@/lib/request"
import type { DeckCard, MixNiche } from "@/lib/vibe/data"
import { type Answer, type Blurbs, scoreVibe, templateBlurb, topMix } from "@/lib/vibe/score"
import { saveVibeResult } from "@/lib/vibe/storage"
import { recordVibeCheck } from "@/lib/taste/store"
import { VibeDeck } from "./vibe-deck"
import { VibeResult } from "./vibe-result"

export interface NicheInfo {
  name: string
  tagline: string
  palette: readonly string[]
  imageUrl: string | null
  branch?: string
}

interface VibeCheckFlowProps {
  cards: readonly DeckCard[]
  /** Every niche the deck can land on. */
  niches: Readonly<Record<string, NicheInfo>>
  blurbs: Blurbs
}

/**
 * Deck → result. The template blurb shows instantly; if the server has an
 * Anthropic key and budget, a personalized one replaces it.
 */
export function VibeCheckFlow({ cards, niches, blurbs }: VibeCheckFlowProps) {
  const [result, setResult] = useState<{ mix: MixNiche[]; blurb: string } | null>(null)
  const [round, setRound] = useState(0)

  const finish = (answers: Record<string, Answer>) => {
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
    setResult({ mix, blurb })
    if (mix.length === 0) return
    saveVibeResult({ mix: shares, blurb, takenAt: Date.now() })
    recordVibeCheck(mix)

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
  if (result) return <VibeResult mix={result.mix} blurb={result.blurb} onRetake={retake} />
  return (
    <div className="mx-auto h-full w-full max-w-md px-4 pb-6 md:pt-6">
      <VibeDeck key={round} cards={cards} onComplete={finish} />
    </div>
  )
}
