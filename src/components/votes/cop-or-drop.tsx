"use client"

import { useEffect, useState } from "react"
import type { VoteChoice } from "@/db/schema"
import { track } from "@/lib/analytics"
import type { FeedItem } from "@/lib/feed/types"
import type { ApiResponse } from "@/lib/request"
import { cn } from "@/lib/utils"
import { VOTE_TARGET, type VoteTally, splitOf } from "@/lib/votes/split"
import { castVote, useMyVote } from "@/lib/votes/store"

/** The split once you've voted: real counts only. */
export function splitLabel(tally: VoteTally, mine: "cop" | "drop"): string {
  const { total, pct } = splitOf(tally, "cop")
  if (total <= 1) return mine === "cop" ? "You're the first to cop" : "You're the first to drop"
  return `${pct}% cop · ${total} votes`
}

async function fetchTally(target: string): Promise<VoteTally | null> {
  try {
    const response = await fetch(`/api/vote?targets=${encodeURIComponent(target)}`)
    const body = (await response.json()) as ApiResponse<{ tallies: Record<string, VoteTally> }>
    return body.success ? (body.data.tallies[target] ?? {}) : null
  } catch {
    return null
  }
}

/**
 * Cop or Drop on an item (a listing, fit, track or pin; never a person).
 * Voting feeds taste and reveals how everyone else voted.
 */
export function CopOrDrop({
  item,
  tone = "plain",
  size = "md",
  className,
}: {
  item: FeedItem
  /** "overlay" sits on imagery (stories); "plain" on surfaces. */
  tone?: "plain" | "overlay"
  /** "sm" for list rows (The Sound). */
  size?: "sm" | "md"
  className?: string
}) {
  const mine = useMyVote(item.id)
  const [tally, setTally] = useState<VoteTally | null>(null)
  const votable = VOTE_TARGET.test(item.id)

  // Coming back to something you voted on: show where the vote stands now.
  useEffect(() => {
    if (!votable || !mine || tally) return
    let cancelled = false
    void fetchTally(item.id).then((found) => {
      if (!cancelled && found) setTally(found)
    })
    return () => {
      cancelled = true
    }
  }, [item.id, mine, tally, votable])

  if (!votable) return null
  const vote = async (choice: Extract<VoteChoice, "cop" | "drop">) => {
    track("cop_or_drop", { choice, kind: item.type })
    const counted = await castVote(item.id, choice, item)
    if (counted) setTally(counted)
  }
  const overlay = tone === "overlay"
  const pill = cn(
    "rounded-full font-semibold transition-colors active:scale-[0.97]",
    size === "sm" ? "h-7 px-3 text-caption" : "h-9 flex-1 text-footnote",
    overlay
      ? "bg-white/15 text-white backdrop-blur-md hover:bg-white/25"
      : "border border-border-strong hover:bg-muted",
  )

  if (mine === "cop" || mine === "drop") {
    const { pct } = splitOf(tally ?? {}, "cop")
    return (
      <div className={cn("flex items-center gap-3", className)} data-taste-ignore>
        <span
          className={cn(
            "relative h-1.5 flex-1 overflow-hidden rounded-full",
            overlay ? "bg-white/25" : "bg-muted",
          )}
          aria-hidden
        >
          {tally ? (
            <span
              className={cn(
                "absolute inset-y-0 left-0 rounded-full",
                overlay ? "bg-white" : "bg-foreground",
              )}
              style={{ width: `${pct}%` }}
            />
          ) : null}
        </span>
        <span
          className={cn(
            "shrink-0 text-caption font-semibold tabular-nums",
            overlay ? "text-white" : undefined,
          )}
          aria-live="polite"
        >
          {tally ? splitLabel(tally, mine) : mine === "cop" ? "Copped" : "Dropped"}
        </span>
        <button
          type="button"
          onClick={() => void vote(mine === "cop" ? "drop" : "cop")}
          className={cn(
            "shrink-0 text-caption underline-offset-2 hover:underline",
            overlay ? "text-white/70" : "text-muted-foreground",
          )}
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div className={cn("flex gap-2", className)} data-taste-ignore>
      <button
        type="button"
        onClick={() => void vote("cop")}
        className={pill}
        aria-label={`Cop: ${item.title}`}
      >
        Cop
      </button>
      <button
        type="button"
        onClick={() => void vote("drop")}
        className={pill}
        aria-label={`Drop: ${item.title}`}
      >
        Drop
      </button>
    </div>
  )
}
