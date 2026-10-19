"use client"

import {
  CloudOff,
  Hourglass,
  type LucideIcon,
  MoonStar,
  PenLine,
  SearchX,
  TriangleAlert,
  Wand2,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import type { NicheApiErrorCode, ResolvedNiche } from "@/app/api/niches/route"
import { Button } from "@/components/ds/button"
import { NicheAvatar } from "@/components/ds/niche-avatar"
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

const ERROR_ICON: Record<NicheApiErrorCode, LucideIcon> = {
  capped: MoonStar,
  "rate-limited": Hourglass,
  unavailable: CloudOff,
  rejected: SearchX,
  "invalid-input": PenLine,
  failed: TriangleAlert,
}

const ERROR_TITLE: Record<NicheApiErrorCode, string> = {
  capped: "The vibe machine is resting",
  "rate-limited": "Easy there, niche collector",
  unavailable: "New niches are coming soon",
  rejected: "That one's not giving niche",
  "invalid-input": "Try that again",
  failed: "The vibe machine hiccuped",
}

/** Codes where pointing at existing niches is the best next step. */
const SUGGEST_PRESETS = new Set<NicheApiErrorCode>(["capped", "rate-limited", "unavailable"])

/** Deterministic picks so suggestions vary by query but not per render. */
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
      setState({ kind: "error", code: "failed", message: "Check your connection and try again." })
    }
  }

  if (state.kind === "loading") {
    return (
      <div role="status" aria-live="polite" className="mx-auto max-w-md py-12 text-center">
        <p className="font-serif text-title-2 italic">Mapping “{query}”</p>
        <p className="mt-2 text-callout text-muted-foreground">
          Finding the artists, the fits and the lore. About ten seconds.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-3">
          <Skeleton className="aspect-[4/5] rounded-2xl" />
          <Skeleton className="aspect-[4/5] rounded-2xl" />
        </div>
      </div>
    )
  }

  if (state.kind === "error") {
    return (
      <EmptyState
        icon={ERROR_ICON[state.code]}
        title={ERROR_TITLE[state.code]}
        body={state.message}
        action={
          SUGGEST_PRESETS.has(state.code) ? (
            <Suggestions presets={pickSuggestions(query, presets)} />
          ) : state.code === "failed" ? (
            <Button onClick={summon}>Try again</Button>
          ) : null
        }
      />
    )
  }

  return (
    <EmptyState
      icon={Wand2}
      title={`“${query}” isn't on the map yet`}
      body="Want us to map it? We'll find the sounds, the fits and the lore."
      action={
        <Button onClick={summon}>
          <Wand2 aria-hidden /> Summon it
        </Button>
      }
    />
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
            className="flex items-center gap-2 rounded-full bg-muted py-1 pr-4 pl-1 text-callout font-medium transition-colors hover:bg-border-strong"
          >
            <NicheAvatar
              slug={preset.slug}
              name={preset.name}
              palette={preset.palette}
              imageUrl={preset.imageUrl}
              size="sm"
            />
            {preset.name}
          </Link>
        </li>
      ))}
    </ul>
  )
}
