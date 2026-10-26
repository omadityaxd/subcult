"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import type { ApiResponse } from "@/lib/request"

/** First post: pick the public handle fits are credited to (never the email). */
export function HandleForm({
  intro = "First, pick the handle your fits show up under.",
  next,
}: {
  intro?: string
  /** Where to go once the handle is saved (first sign-in: the vibe check). Default: stay. */
  next?: string
}) {
  const router = useRouter()
  const [handle, setHandle] = useState("")
  const [olderThan13, setOlderThan13] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const response = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle, ageConfirmed: olderThan13 }),
    })
    const body = (await response.json()) as ApiResponse<{ handle: string }>
    setBusy(false)
    if (!body.success) setError(body.error)
    else if (next) router.push(next)
    else router.refresh()
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="max-w-sm space-y-3">
      <p className="text-callout text-muted-foreground">{intro}</p>
      <label className="block">
        <span className="text-footnote font-medium">Handle</span>
        <span className="mt-1.5 flex h-12 items-center rounded-xl border border-border-strong px-4 focus-within:border-foreground">
          <span className="text-muted-foreground">@</span>
          <input
            required
            value={handle}
            onChange={(event) => setHandle(event.target.value.toLowerCase())}
            autoComplete="username"
            maxLength={24}
            pattern="[a-z0-9._]{3,24}"
            className="h-full flex-1 bg-transparent pl-0.5 text-body outline-none"
            placeholder="yourname"
          />
        </span>
      </label>
      <label className="flex items-start gap-3 text-footnote">
        <input
          type="checkbox"
          required
          checked={olderThan13}
          onChange={(event) => setOlderThan13(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-foreground"
        />
        <span>
          I&apos;m 13 or older, and I agree to the{" "}
          <a href="/terms" target="_blank" className="underline underline-offset-2">
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" target="_blank" className="underline underline-offset-2">
            Privacy Policy
          </a>
          .
        </span>
      </label>
      {error ? (
        <p role="alert" className="text-footnote text-muted-foreground">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy || !olderThan13}
        className="h-11 rounded-full bg-foreground px-6 text-callout font-semibold text-background disabled:opacity-60"
      >
        {busy ? "Saving…" : "Continue"}
      </button>
    </form>
  )
}
