"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import type { ApiResponse } from "@/lib/request"

/** First post: pick the public handle fits are credited to (never the email). */
export function HandleForm() {
  const router = useRouter()
  const [handle, setHandle] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const response = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle }),
    })
    const body = (await response.json()) as ApiResponse<{ handle: string }>
    setBusy(false)
    if (body.success) router.refresh()
    else setError(body.error)
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="max-w-sm space-y-3">
      <p className="text-callout text-muted-foreground">
        First, pick the handle your fits show up under.
      </p>
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
      {error ? (
        <p role="alert" className="text-footnote text-muted-foreground">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="h-11 rounded-full bg-foreground px-6 text-callout font-semibold text-background disabled:opacity-60"
      >
        {busy ? "Saving…" : "Continue"}
      </button>
    </form>
  )
}
