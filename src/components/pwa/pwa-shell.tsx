"use client"

import { Share, WifiOff, X } from "lucide-react"
import { useEffect, useState, useSyncExternalStore } from "react"

const VISITS_KEY = "subcult-visits-v1"
const DISMISSED_KEY = "subcult-install-dismissed"
const ASK_AGAIN_MS = 30 * 24 * 3600_000

interface InstallEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

/** A returning visitor: Today's visit marker already has a previous session. */
function isSecondVisit(): boolean {
  try {
    const visits = JSON.parse(localStorage.getItem(VISITS_KEY) ?? "null") as {
      previous: number | null
    } | null
    return Boolean(visits?.previous)
  } catch {
    return false
  }
}

function recentlyDismissed(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(DISMISSED_KEY) ?? 0) < ASK_AGAIN_MS
  } catch {
    return true
  }
}

const subscribeOnline = (listener: () => void) => {
  window.addEventListener("online", listener)
  window.addEventListener("offline", listener)
  return () => {
    window.removeEventListener("online", listener)
    window.removeEventListener("offline", listener)
  }
}

/**
 * PWA plumbing for the tabs layout: registers the service worker (production
 * only: it would fight dev hot reload), shows an offline banner, and offers
 * install from the second visit (native prompt; instructions on iPhone).
 */
export function PwaShell() {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  )
  const [install, setInstall] = useState<InstallEvent | "ios" | null>(null)

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined)
    }
    if (isStandalone() || recentlyDismissed() || !isSecondVisit()) return
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setInstall(event as InstallEvent)
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    // iOS has no install event: explain Add to Home Screen instead.
    const iosTimer = isIos() ? setTimeout(() => setInstall("ios"), 4000) : null
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      if (iosTimer) clearTimeout(iosTimer)
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    } catch {
      // asked again next visit
    }
    setInstall(null)
  }

  return (
    <>
      {online ? null : (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-(--z-banner) flex items-center justify-center gap-2 bg-foreground px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2 text-footnote font-semibold text-background"
        >
          <WifiOff aria-hidden className="size-4" strokeWidth={2} />
          You&apos;re offline. Showing what was saved on this device.
        </div>
      )}
      {install ? (
        <div className="fixed inset-x-3 bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom)+var(--footer-space,0px)+var(--player-space,0px)+0.75rem)] z-(--z-float) flex items-center gap-3 rounded-2xl border border-border bg-elevated p-3 shadow-pop md:right-6 md:bottom-[calc(1.5rem+var(--footer-space,0px)+var(--player-space,0px))] md:left-auto md:w-96">
          <span className="min-w-0 flex-1 text-footnote">
            {install === "ios" ? (
              <>
                Add subcult to your Home Screen: tap{" "}
                <Share aria-label="Share" className="inline size-3.5 align-text-bottom" /> then
                &ldquo;Add to Home Screen&rdquo;. Alerts work there.
              </>
            ) : (
              "Install subcult: Today opens in one tap, and alerts can reach you."
            )}
          </span>
          {install !== "ios" ? (
            <button
              type="button"
              onClick={async () => {
                await install.prompt()
                await install.userChoice.catch(() => undefined)
                setInstall(null)
              }}
              className="h-9 shrink-0 rounded-full bg-foreground px-4 text-footnote font-semibold text-background"
            >
              Install
            </button>
          ) : null}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Not now"
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ) : null}
    </>
  )
}
