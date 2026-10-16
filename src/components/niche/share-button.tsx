"use client"

import { Check, Share } from "lucide-react"
import { useState } from "react"
import { recordSignal } from "@/lib/taste/store"

const COPIED_MS = 1800

/** Native share sheet where available (iOS/Android), copy-link elsewhere. */
export function ShareButton({ name, slug }: { name: string; slug: string }) {
  const [copied, setCopied] = useState(false)

  async function share() {
    const url = `${window.location.origin}/n/${slug}`
    if (navigator.share) {
      try {
        await navigator.share({ title: `${name} · subcult`, url })
        recordSignal("share", [{ ref: `niche:${slug}`, label: name }])
        return
      } catch {
        // Dismissed share sheet: nothing to do.
        return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      recordSignal("share", [{ ref: `niche:${slug}`, label: name }])
      setCopied(true)
      setTimeout(() => setCopied(false), COPIED_MS)
    } catch {
      // Clipboard blocked: leave the button as-is.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label={copied ? "Link copied" : `Share ${name}`}
      className="grid size-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur-md transition-colors hover:bg-white/25 active:scale-95"
    >
      {copied ? (
        <Check aria-hidden className="size-[18px]" strokeWidth={1.75} />
      ) : (
        <Share aria-hidden className="size-[18px]" strokeWidth={1.5} />
      )}
      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
    </button>
  )
}
