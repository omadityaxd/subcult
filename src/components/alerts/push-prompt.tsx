"use client"

import { useEffect, useState } from "react"
import { ResponsiveSheet } from "@/components/ds/responsive-sheet"
import { Button } from "@/components/ds/button"
import { MEANINGFUL_ACTION_EVENT, type PushState, enablePush, pushState } from "@/lib/alerts/client"

const DISMISSED_KEY = "subcult-push-prompt-dismissed"
/** After "not now", wait two weeks before asking again. */
const ASK_AGAIN_MS = 14 * 24 * 3600_000

const COPY: Record<"grail" | "follow", string> = {
  grail: "We'll tell you when a match is listed. One push a day at most, never at night.",
  follow: "Get a heads-up when they drop something or the scene blows up. One push a day at most.",
}

function recentlyDismissed(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(DISMISSED_KEY) ?? 0) < ASK_AGAIN_MS
  } catch {
    return false
  }
}

/**
 * Offers push only after something meaningful (saving a grail hunt,
 * following), never on a first visit. Signed-in only: alerts live on the
 * account. On an iPhone outside the Home Screen app it explains the install.
 */
export function PushPromptHost({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [reason, setReason] = useState<"grail" | "follow" | null>(null)
  const [state, setState] = useState<PushState>("off")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!vapidPublicKey) return
    const onAction = async (event: Event) => {
      const why = (event as CustomEvent<{ reason: "grail" | "follow" }>).detail?.reason
      if (!why || recentlyDismissed()) return
      const current = await pushState()
      if (current !== "off" && current !== "needs-install") return
      // Alerts need an account; a guest's follow isn't a reason to ask.
      const signedIn = await fetch("/api/alerts/prefs").then(
        (r) => r.ok,
        () => false,
      )
      if (!signedIn) return
      setState(current)
      setReason(why)
    }
    window.addEventListener(MEANINGFUL_ACTION_EVENT, onAction)
    return () => window.removeEventListener(MEANINGFUL_ACTION_EVENT, onAction)
  }, [vapidPublicKey])

  const close = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    } catch {
      // ask again next time
    }
    setReason(null)
  }

  if (!reason || !vapidPublicKey) return null
  return (
    <ResponsiveSheet
      open
      onOpenChange={(open) => (open ? undefined : close())}
      title="Turn on alerts?"
      description={COPY[reason]}
    >
      {state === "needs-install" ? (
        <p className="text-callout text-muted-foreground">
          On iPhone, alerts work in the app: tap Share, then Add to Home Screen, and open subcult
          from there. Until then, they wait for you under the bell.
        </p>
      ) : (
        <Button
          className="w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const next = await enablePush(vapidPublicKey).catch((): PushState => "off")
            setBusy(false)
            if (next === "on" || next === "blocked") setReason(null)
            setState(next)
          }}
        >
          {busy ? "Turning on…" : "Turn on alerts"}
        </Button>
      )}
      <Button variant="ghost" className="mt-2 w-full" onClick={close}>
        Not now
      </Button>
    </ResponsiveSheet>
  )
}
