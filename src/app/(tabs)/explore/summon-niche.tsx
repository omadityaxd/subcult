"use client"

import { Sparkles } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import type { NicheApiErrorCode, ResolvedNiche } from "@/app/api/niches/route"
import { EmptyState } from "@/components/shell/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import type { NichePreset } from "@/lib/niches/catalog"
import type { ApiResponse } from "@/lib/request"

type SummonState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; code: NicheApiErrorCode; message: string }

interface SummonNicheProps {
  query: string
  presets: readonly NichePreset[]
}

const ERROR_EMOJI: Record<NicheApiErrorCode, string> = {
  capped: "😴",
  "rate-limited": "🌙",
  unavailable: "🔌",
  rejected: "🤔",
  "invalid-input": "✏️",
  failed: "💥",
}

const ERROR_TITLE: Record<NicheApiErrorCode, string> = {
  capped: "the vibe machine is resting",
  "rate-limited": "easy there, niche collector",
  unavailable: "new niches are offline rn",
  rejected: "that one's not giving niche",
  "invalid-input": "hmm, try that again",
  failed: "the vibe machine hiccuped",
}

/** Codes where pointing at existing niches is the best next step. */
const SUGGEST_PRESETS = new Set<NicheApiErrorCode>(["capped", "rate-limited", "unavailable"])

/** Deterministic "random" picks so suggestions vary by query but not per render. */
function pickSuggestions(query: string, presets: readonly NichePreset[], count = 3) {
  const seed = [...query].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return Array.from({ length: Math.min(count, presets.length) }, (_, i) => {
    return presets[(seed + i * 7) % presets.length]
  })
}

/** Empty search result → offer to generate the niche via POST /api/niches. */
export function SummonNiche({ query, presets }: SummonNicheProps) {
  const router = useRouter()
  const [state, setState] = useState<SummonState>({ kind: "idle" })

  async function summon() {
    setState({ kind: "loading" })
    try {
      const response = await fetch("/api/niches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: query }),
      })
      // Our own API: the envelope shape is guaranteed by apiOk/apiError.
      const body = (await response.json()) as ApiResponse<ResolvedNiche>
      if (body.success) {
        router.push(`/n/${body.data.slug}`)
        return
      }
      const code = (body.code ?? "failed") as NicheApiErrorCode
      setState({ kind: "error", code, message: body.error })
    } catch {
      setState({ kind: "error", code: "failed", message: "check your connection and try again" })
    }
  }

  if (state.kind === "loading") {
    return (
      <div role="status" aria-live="polite" className="mt-5 rounded-3xl bg-card p-6">
        <p className="font-display text-xl font-semibold">cooking up “{query}” 🍳</p>
        <p className="mt-1 text-[15px] text-muted-foreground">
          finding the artists, the fits and the lore. ~10 seconds.
        </p>
        <div className="mt-5 space-y-3">
          <Skeleton className="h-6 w-2/3 rounded-lg" />
          <Skeleton className="h-4 w-full rounded-lg" />
          <Skeleton className="h-4 w-5/6 rounded-lg" />
        </div>
      </div>
    )
  }

  if (state.kind === "error") {
    const showSuggestions = SUGGEST_PRESETS.has(state.code)
    return (
      <EmptyState
        className="mt-5"
        emoji={ERROR_EMOJI[state.code]}
        title={ERROR_TITLE[state.code]}
        body={state.message}
        action={
          showSuggestions ? (
            <Suggestions presets={pickSuggestions(query, presets)} />
          ) : state.code === "failed" ? (
            <SummonButton onClick={summon}>try again</SummonButton>
          ) : null
        }
      />
    )
  }

  return (
    <EmptyState
      className="mt-5"
      emoji="🔭"
      title={`“${query}” isn't on the map yet`}
      body="want us to cook it up? we'll map the sounds, fits and lore in about 10 seconds."
      action={<SummonButton onClick={summon}>summon it</SummonButton>}
    />
  )
}

function SummonButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-[15px] font-semibold text-accent-foreground active:scale-95"
    >
      <Sparkles aria-hidden className="size-4" />
      {children}
    </button>
  )
}

function Suggestions({ presets }: { presets: readonly NichePreset[] }) {
  return (
    <ul className="flex flex-wrap justify-center gap-2">
      {presets.map((preset) => (
        <li key={preset.slug}>
          <Link
            href={`/n/${preset.slug}`}
            transitionTypes={["nav-forward"]}
            className="flex items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-[15px] font-medium"
          >
            <span aria-hidden>{preset.emoji}</span>
            {preset.name}
          </Link>
        </li>
      ))}
    </ul>
  )
}
