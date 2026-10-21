"use client"

import { Download, Trash2 } from "lucide-react"
import { useState } from "react"
import type { ApiResponse } from "@/lib/request"

/** Everything this device keeps (taste, saves, votes, issues, recent searches). */
function clearDevice(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("subcult-")) localStorage.removeItem(key)
    }
  } catch {
    // Storage blocked: nothing stored to clear.
  }
}

/** Me → your data: download all of it, or delete the account and everything with it. */
export function AccountData({ handle }: { handle: string | null }) {
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState("")
  const [state, setState] = useState<"idle" | "deleting" | string>("idle")
  const phrase = handle ? `@${handle}` : "delete"

  async function remove() {
    setState("deleting")
    const response = await fetch("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: typed }),
    }).catch(() => null)
    const body = response
      ? ((await response.json().catch(() => null)) as ApiResponse<{ deleted: boolean }> | null)
      : null
    if (body?.success) {
      clearDevice()
      // A full reload, not a client navigation: in-memory stores still hold the old taste.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/")
    } else setState(body && !body.success ? body.error : "Couldn't reach the server. Try again.")
  }

  return (
    <section aria-labelledby="your-data" className="space-y-3">
      <h2 id="your-data" className="text-headline font-semibold">
        Your data
      </h2>
      <a
        href="/api/account"
        download
        className="flex h-12 items-center justify-between rounded-2xl bg-card px-4 text-body hover:bg-muted"
      >
        Download everything we have about you
        <Download aria-hidden className="size-4 text-muted-foreground" strokeWidth={1.75} />
      </a>
      {confirming ? (
        <div className="space-y-3 rounded-2xl border border-destructive/60 p-4">
          <p className="text-callout">
            This deletes your account, taste profile, fits and their photos, likes, saves, follows,
            votes and alerts. It can&apos;t be undone.
          </p>
          <label className="block">
            <span className="text-footnote text-muted-foreground">Type {phrase} to confirm</span>
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              className="mt-1.5 h-11 w-full rounded-xl border border-border-strong bg-transparent px-4 text-body outline-none focus:border-foreground"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={typed.trim().toLowerCase() !== phrase || state === "deleting"}
              onClick={() => void remove()}
              className="h-11 rounded-full bg-destructive px-5 text-callout font-semibold text-white disabled:opacity-40"
            >
              {state === "deleting" ? "Deleting…" : "Delete my account"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false)
                setTyped("")
                setState("idle")
              }}
              className="h-11 rounded-full border border-border-strong px-5 text-callout font-semibold"
            >
              Keep it
            </button>
          </div>
          {state !== "idle" && state !== "deleting" ? (
            <p role="alert" className="text-footnote text-muted-foreground">
              {state}
            </p>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex h-12 w-full items-center justify-between rounded-2xl bg-card px-4 text-left text-body text-destructive hover:bg-muted"
        >
          Delete my account and data
          <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
        </button>
      )}
    </section>
  )
}
