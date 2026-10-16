"use client"

import { X } from "lucide-react"
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
  children: ReactNode
}

/**
 * Wraps a feed card: learns from dwell and opens, says why it's here, and
 * takes "not my vibe" (which hides it and steers future ranking away).
 */
export function TasteCard({ item, niche, reason, children }: TasteCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [dismissed, setDismissed] = useState(false)

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
      {reason ? (
        <div className="mb-1.5 flex items-center gap-2 px-0.5">
          <p className="min-w-0 flex-1 truncate text-caption text-muted-foreground">{reason}</p>
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
      {children}
    </div>
  )
}
