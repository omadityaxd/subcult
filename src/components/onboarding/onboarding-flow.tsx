"use client"

import { ArrowRight, Check } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { MediaImage } from "@/components/ds/media-image"
import type { StartSuggestion } from "@/app/api/start/route"
import { followItem } from "@/lib/follows"
import type { NichePreset } from "@/lib/niches/catalog"
import type { ApiResponse } from "@/lib/request"
import { setSaved } from "@/lib/saves"
import { recordSignal } from "@/lib/taste/store"
import { cn } from "@/lib/utils"
import { track } from "@/lib/analytics"

const PICK = 3
const MAX_PICK = 5
const FOLLOW = 3
const SHOWN = 24
export const ONBOARDED_KEY = "subcult-onboarded-v1"

type Step = "niches" | "follow" | "done"

/**
 * The 60-second setup after the vibe check: pick 3 niches (your result is
 * pre-selected), optionally follow 3 artists or brands from them, land on a
 * personalized Today. Sign-in is offered at the end, never required here.
 */
export function OnboardingFlow({
  presets,
  preselected,
  signedIn,
}: {
  presets: readonly NichePreset[]
  preselected: readonly string[]
  signedIn: boolean
}) {
  const router = useRouter()
  const [step, setStep] = useState<Step>("niches")
  const [picked, setPicked] = useState<string[]>(() =>
    preselected.filter((slug) => presets.some((p) => p.slug === slug)).slice(0, PICK),
  )
  const [showAll, setShowAll] = useState(false)
  const [suggestions, setSuggestions] = useState<StartSuggestion[] | null>(null)
  const [follows, setFollows] = useState<string[]>([])

  useEffect(() => {
    if (step !== "follow" || suggestions) return
    let cancelled = false
    fetch(`/api/start?niches=${picked.join(",")}`)
      .then((r) => r.json() as Promise<ApiResponse<{ suggestions: StartSuggestion[] }>>)
      .then((body) => !cancelled && setSuggestions(body.success ? body.data.suggestions : []))
      .catch(() => !cancelled && setSuggestions([]))
    return () => {
      cancelled = true
    }
  }, [step, picked, suggestions])

  useEffect(() => {
    track("onboarding_started", { preselected: preselected.length })
  }, [preselected.length])

  const finish = () => {
    for (const slug of picked) {
      const preset = presets.find((p) => p.slug === slug)
      if (preset) setSaved(followItem(preset), true)
    }
    for (const key of follows) {
      const s = suggestions?.find((x) => `${x.kind}:${x.slug}` === key)
      if (s) recordSignal("follow", [{ ref: `${s.kind}:${s.slug}`, label: s.name }])
    }
    try {
      localStorage.setItem(ONBOARDED_KEY, String(Date.now()))
    } catch {
      // Not remembered: they may see the setup offer again.
    }
    track("onboarding_completed", { niches: picked.length, follows: follows.length })
    setStep("done")
  }

  const ordered = [
    ...picked.flatMap((slug) => presets.find((p) => p.slug === slug) ?? []),
    ...presets.filter((p) => !picked.includes(p.slug)),
  ]
  const visible = showAll ? ordered : ordered.slice(0, SHOWN)

  return (
    <div className="container-page max-w-3xl pt-[calc(env(safe-area-inset-top)+2rem)] pb-48 md:pb-32">
      <ol aria-label="Setup progress" className="mb-8 flex gap-2">
        {(["niches", "follow", "done"] as const).map((s, i) => (
          <li
            key={s}
            aria-current={step === s ? "step" : undefined}
            className={cn(
              "h-1 flex-1 rounded-full",
              ["niches", "follow", "done"].indexOf(step) >= i ? "bg-foreground" : "bg-muted",
            )}
          />
        ))}
      </ol>

      {step === "niches" ? (
        <>
          <h1 className="font-serif text-title-1 italic">Pick your niches</h1>
          <p className="mt-2 text-callout text-muted-foreground">
            {preselected.length > 0
              ? "Your vibe check picked these. Keep them, swap them, add up to five."
              : "Choose three to start. You can follow more anytime."}
          </p>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visible.map((preset) => {
              const on = picked.includes(preset.slug)
              return (
                <li key={preset.slug}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setPicked((current) =>
                        on
                          ? current.filter((s) => s !== preset.slug)
                          : current.length >= MAX_PICK
                            ? current
                            : [...current, preset.slug],
                      )
                    }
                    className={cn(
                      "relative flex h-20 w-full items-end overflow-hidden rounded-2xl p-3 text-left transition-transform active:scale-[0.98]",
                      on ? "ring-2 ring-foreground" : "ring-1 ring-border",
                    )}
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${preset.palette[1]}, ${preset.palette[0]})`,
                    }}
                  >
                    <span className="relative font-serif text-title-3 leading-tight text-white italic">
                      {preset.name}
                    </span>
                    {on ? (
                      <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-white text-black">
                        <Check aria-hidden className="size-3.5" strokeWidth={2.5} />
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
          {!showAll && ordered.length > SHOWN ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-4 h-10 rounded-full border border-border-strong px-4 text-footnote font-semibold"
            >
              Show all {ordered.length}
            </button>
          ) : null}
          <BottomBar>
            <span className="text-footnote text-muted-foreground tabular-nums">
              {picked.length} of {PICK}
            </span>
            <button
              type="button"
              disabled={picked.length < PICK}
              onClick={() => setStep("follow")}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-6 text-callout font-semibold text-background disabled:opacity-40"
            >
              Next <ArrowRight aria-hidden className="size-4" />
            </button>
          </BottomBar>
        </>
      ) : step === "follow" ? (
        <>
          <h1 className="font-serif text-title-1 italic">Follow a few</h1>
          <p className="mt-2 text-callout text-muted-foreground">
            Optional: pick up to three and Today starts with them.
          </p>
          {suggestions === null ? (
            <p className="mt-6 text-callout text-muted-foreground">Finding people…</p>
          ) : suggestions.length === 0 ? (
            <p className="mt-6 text-callout text-muted-foreground">
              Nothing to suggest for these yet. You can skip this.
            </p>
          ) : (
            <ul className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {suggestions.map((s) => {
                const key = `${s.kind}:${s.slug}`
                const on = follows.includes(key)
                return (
                  <li key={key}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setFollows((current) =>
                          on
                            ? current.filter((k) => k !== key)
                            : current.length >= FOLLOW
                              ? current
                              : [...current, key],
                        )
                      }
                      className="block w-full text-center"
                    >
                      <span
                        className={cn(
                          "relative mx-auto grid aspect-square w-full place-items-center overflow-hidden bg-muted",
                          s.kind === "artist" ? "rounded-full" : "rounded-2xl",
                          on && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                        )}
                      >
                        {s.imageUrl ? (
                          <MediaImage src={s.imageUrl} alt="" sizes="120px" />
                        ) : (
                          <span className="px-2 font-serif text-title-3 italic">{s.name}</span>
                        )}
                      </span>
                      <span className="mt-2 block truncate text-footnote font-semibold">
                        {s.name}
                      </span>
                      <span className="block truncate text-caption text-muted-foreground">
                        {s.niche}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <BottomBar>
            <button
              type="button"
              onClick={() => setStep("niches")}
              className="h-12 rounded-full px-4 text-callout font-medium text-muted-foreground"
            >
              Back
            </button>
            <button
              type="button"
              onClick={finish}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-6 text-callout font-semibold text-background"
            >
              {follows.length > 0 ? "Done" : "Skip"} <ArrowRight aria-hidden className="size-4" />
            </button>
          </BottomBar>
        </>
      ) : (
        <div className="pt-12 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full border border-border-strong">
            <Check aria-hidden className="size-6" strokeWidth={2} />
          </span>
          <h1 className="mt-6 font-serif text-title-1 italic">Your Today is ready</h1>
          <p className="mt-2 text-callout text-muted-foreground">
            Built from your picks. It learns from what you play and save.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-8 text-callout font-semibold text-background"
            >
              Open Today <ArrowRight aria-hidden className="size-4" />
            </button>
            {signedIn ? null : (
              <Link
                href="/login?next=/"
                className="inline-flex h-12 items-center rounded-full px-6 text-callout font-medium text-muted-foreground hover:bg-muted"
              >
                Sign in to keep it on every device, get alerts and add friends
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background/90 pb-3 backdrop-blur-xl md:bottom-0 md:left-(--rail-width) md:pb-[calc(env(safe-area-inset-bottom)+0.75rem)] xl:left-(--sidebar-width)">
      <div className="container-page flex max-w-3xl items-center justify-between gap-3 pt-3">
        {children}
      </div>
    </div>
  )
}
