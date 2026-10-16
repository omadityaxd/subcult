"use client"

import Link from "next/link"
import { useState } from "react"
import { SectionHeader } from "@/components/ds/section-header"
import { resetTaste } from "@/components/taste/taste-tracker"
import { entityType } from "@/lib/taste/entities"
import { type Affinity, isColdStart, topEntities } from "@/lib/taste/model"
import { useTasteVector } from "@/lib/taste/store"

const SHOWN = 10

const TYPE_LABEL: Record<ReturnType<typeof entityType>, string> = {
  artist: "Artist",
  brand: "Brand",
  niche: "Niche",
  tag: "Tag",
}

const BECAUSE: Partial<Record<NonNullable<Affinity["because"]>, string>> = {
  play: "played",
  play_through: "played through",
  save: "saved",
  like: "liked",
  share: "shared",
  follow: "followed",
  vibe_check: "vibe check",
  open: "opened",
  dwell: "lingered",
}

/** "Your taste right now": top entities as bars, each with what moved it, and a reset. */
export function TasteSection() {
  const vector = useTasteVector()
  const [state, setState] = useState<"idle" | "confirm" | "busy" | "failed">("idle")
  const top = topEntities(vector, SHOWN)
  const max = top[0]?.score ?? 1

  return (
    <section>
      <SectionHeader
        overline="Learned from what you play, save and skip"
        title="Your taste right now"
      />
      {isColdStart(vector) ? (
        <div className="rounded-2xl border border-dashed border-border-strong p-6 text-center">
          <p className="font-serif text-title-3 italic">Nothing learned yet</p>
          <p className="mt-2 text-callout text-muted-foreground">
            Play, save and follow a few things, or take the vibe check for a head start.
          </p>
          <Link
            href="/vibe-check"
            className="mt-4 inline-flex h-10 items-center rounded-full bg-foreground px-4 text-footnote font-semibold text-background"
          >
            Take the vibe check
          </Link>
        </div>
      ) : (
        <>
          <ol className="space-y-3">
            {top.map((affinity) => (
              <li key={affinity.entity}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-callout font-semibold">
                    {affinity.label}
                    <span className="ml-2 text-caption font-normal text-subtle">
                      {TYPE_LABEL[entityType(affinity.entity)]}
                    </span>
                  </p>
                  {affinity.because ? (
                    <span className="shrink-0 text-caption text-muted-foreground">
                      {BECAUSE[affinity.because] ?? ""}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground"
                    style={{ width: `${Math.max(4, (affinity.score / max) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {state === "confirm" ? (
              <>
                <span className="text-footnote text-muted-foreground">Forget everything?</span>
                <button
                  type="button"
                  onClick={async () => {
                    setState("busy")
                    setState((await resetTaste()) ? "idle" : "failed")
                  }}
                  className="h-9 rounded-full bg-destructive px-4 text-footnote font-semibold text-white"
                >
                  Reset taste
                </button>
                <button
                  type="button"
                  onClick={() => setState("idle")}
                  className="h-9 rounded-full px-3 text-footnote font-semibold text-muted-foreground"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={state === "busy"}
                onClick={() => setState("confirm")}
                className="h-9 rounded-full border border-border-strong px-4 text-footnote font-semibold"
              >
                Reset taste
              </button>
            )}
            {state === "failed" ? (
              <span className="text-footnote text-destructive">
                Couldn&apos;t reach your account. Try again.
              </span>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}
