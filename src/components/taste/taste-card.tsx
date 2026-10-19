"use client"

import { Info, TrendingUp, X } from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import type { FeedItem } from "@/lib/feed/types"
import { labeledEntitiesOfItem } from "@/lib/taste/entities"
import { recordItemSignal, recordSignal } from "@/lib/taste/store"
import { registerItemEntities } from "./taste-tracker"

/** Seen for this long at ≥50% visible = a dwell signal (once per card per visit). */
const DWELL_MS = 2000

interface TasteCardProps {
  item: FeedItem
  niche: { slug: string; name: string } | null
  /** "Because you played Nettspend": only for personalized cards. */
  reason: string | null
  /** One of the card's entities has real momentum right now (see lib/rising). */
  rising?: boolean
  children: ReactNode
}

/**
 * Wraps a feed card: learns from dwell and opens, says why it's here (behind
 * an info icon, so the reason doesn't sit above every card), and
 * takes "not my vibe" (which hides it and steers future ranking away).
 */
export function TasteCard({ item, niche, reason, rising = false, children }: TasteCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [dismissed, setDismissed] = useState(false)
  const [showWhy, setShowWhy] = useState(false)

  useEffect(() => {
    registerItemEntities(item.id, labeledEntitiesOfItem(item, niche))
  }, [item, niche])

  useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === "undefined") return
    let timer: ReturnType<typeof setTimeout> | null = null
    let done = false
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (done) return
        if (entry?.isIntersecting) {
          timer ??= setTimeout(() => {
            done = true
            recordItemSignal("dwell", item, niche)
            observer.disconnect()
          }, DWELL_MS)
        } else if (timer) {
          clearTimeout(timer)
          timer = null
        }
      },
      { threshold: 0.5 },
    )
    observer.observe(node)
    return () => {
      observer.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [item, niche])

  if (dismissed) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-footnote text-muted-foreground">
        Got it. Less like this.
      </p>
    )
  }

  return (
    <div
      ref={ref}
      onClickCapture={(event) => {
        // Buttons inside the card (save, play) report themselves; this is the open.
        if ((event.target as HTMLElement).closest("button[aria-pressed], [data-taste-ignore]"))
          return
        recordItemSignal("open", item, niche)
      }}
    >
      {reason || rising ? (
        <div className="mb-1.5 flex items-center gap-2 px-0.5">
          {rising ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-caption font-semibold text-accent">
              <TrendingUp aria-hidden className="size-3.5" strokeWidth={2} />
              Rising
            </span>
          ) : null}
          <span className="flex-1" />
          {reason ? (
            <button
              type="button"
              data-taste-ignore
              onClick={() => setShowWhy((v) => !v)}
              aria-expanded={showWhy}
              aria-label="Why you're seeing this"
              title={reason}
              className="-my-2 grid size-8 shrink-0 place-items-center rounded-full text-subtle hover:bg-muted hover:text-foreground"
            >
              <Info aria-hidden className="size-3.5" strokeWidth={2} />
            </button>
          ) : null}
          <button
            type="button"
            data-taste-ignore
            onClick={() => {
              recordSignal("not_my_vibe", labeledEntitiesOfItem(item, niche), { itemId: item.id })
              setDismissed(true)
            }}
            aria-label="Not my vibe"
            title="Not my vibe"
            className="-my-2 grid size-8 shrink-0 place-items-center rounded-full text-subtle hover:bg-muted hover:text-foreground"
          >
            <X aria-hidden className="size-3.5" strokeWidth={2} />
          </button>
        </div>
      ) : null}
      {showWhy && reason ? (
        <p className="mb-2 px-0.5 text-caption text-muted-foreground">{reason}</p>
      ) : null}
      {children}
    </div>
  )
}
