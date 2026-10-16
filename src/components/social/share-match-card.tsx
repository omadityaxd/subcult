"use client"

import { Share } from "lucide-react"
import { useState } from "react"

/** Shares the 1080×1920 card as an image (Stories-ready); downloads where sharing files isn't supported. */
export function ShareMatchCard({ handle, percent }: { handle: string; percent: number }) {
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle")
  return (
    <div>
      <button
        type="button"
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy")
          try {
            const response = await fetch(`/u/${handle}/match/card`)
            if (!response.ok) throw new Error(String(response.status))
            const file = new File([await response.blob()], `vibe-match-${handle}.png`, {
              type: "image/png",
            })
            const text = `We're ${percent}% vibe match on subcult`
            if (navigator.canShare?.({ files: [file] })) {
              await navigator.share({ files: [file], text }).catch(() => undefined)
            } else {
              const url = URL.createObjectURL(file)
              const a = document.createElement("a")
              a.href = url
              a.download = file.name
              a.click()
              URL.revokeObjectURL(url)
            }
            setState("idle")
          } catch {
            setState("failed")
          }
        }}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground text-callout font-semibold text-background disabled:opacity-60"
      >
        <Share aria-hidden className="size-4" strokeWidth={1.75} />
        {state === "busy" ? "Making your card…" : "Share the card"}
      </button>
      {state === "failed" ? (
        <p className="mt-2 text-center text-footnote text-destructive">
          Couldn&apos;t make the card. Try again.
        </p>
      ) : null}
    </div>
  )
}
