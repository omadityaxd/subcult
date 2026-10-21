"use client"

import { motion } from "motion/react"
import { useEffect, useState } from "react"
import type { VoteChoice } from "@/db/schema"
import { track } from "@/lib/analytics"
import { springs } from "@/lib/design/tokens"
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
    if (choice === mine) return
    track("cop_or_drop", { choice, kind: item.type })
    // A tiny buzz where the device supports it: the vote should feel physical.
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10)
    const counted = await castVote(item.id, choice, item)
    if (counted) setTally(counted)
  }
  const overlay = tone === "overlay"
  const voted = mine === "cop" || mine === "drop"
  const split = voted && tally ? splitOf(tally, "cop") : null
  const shares = split && split.total > 1 ? { cop: split.pct, drop: 100 - split.pct } : null

  const button = (choice: "cop" | "drop") => {
    const selected = mine === choice
    return (
      <motion.button
        key={choice}
        type="button"
        whileTap={{ scale: 0.92 }}
        transition={springs.press}
        onClick={() => void vote(choice)}
        aria-pressed={selected}
        aria-label={`${choice === "cop" ? "Cop" : "Drop"}: ${item.title}`}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-colors",
          size === "sm" ? "h-7 px-3 text-caption" : "h-10 flex-1 text-footnote",
          selected
            ? overlay
              ? "bg-white text-black"
              : "bg-foreground text-background"
            : overlay
              ? "bg-white/15 text-white backdrop-blur-md hover:bg-white/25"
              : "border border-border-strong hover:bg-muted",
          voted && !selected && "opacity-70",
        )}
      >
        {choice === "cop" ? "Cop" : "Drop"}
        {shares ? <span className="font-normal tabular-nums">{shares[choice]}%</span> : null}
      </motion.button>
    )
  }

  return (
    <div className={cn("space-y-1.5", className)} data-taste-ignore>
      <div className="flex gap-2">
        {button("cop")}
        {button("drop")}
      </div>
      {voted ? (
        <div className="flex items-center gap-2" aria-live="polite">
          {shares ? (
            <span
              aria-hidden
              className={cn(
                "relative h-1 flex-1 overflow-hidden rounded-full",
                overlay ? "bg-white/25" : "bg-muted",
              )}
            >
              <span
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full transition-[width] duration-500",
                  overlay ? "bg-white" : "bg-foreground",
                )}
                style={{ width: `${shares.cop}%` }}
              />
            </span>
          ) : null}
          <span
            className={cn(
              "shrink-0 text-caption tabular-nums",
              overlay ? "text-white/80" : "text-muted-foreground",
            )}
          >
            {shares && split
              ? `${split.total} votes`
              : tally && mine
                ? splitLabel(tally, mine)
                : mine === "cop"
                  ? "Copped"
                  : "Dropped"}
          </span>
        </div>
      ) : null}
    </div>
  )
}
