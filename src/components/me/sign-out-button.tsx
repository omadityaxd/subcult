"use client"

import { useEffect } from "react"
import { getAudioEngine } from "@/lib/audio/use-audio"
import { PERSONAL_COOKIES, personalStorageKeys } from "@/lib/auth/personal-data"
import { maybeSignedIn } from "@/lib/supabase/session-hint"

/** Taste, saves, the playing track and the rest of this person's state leave the device with them. */
function clearPersonalState(): void {
  getAudioEngine().stop()
  for (const store of [localStorage, sessionStorage]) {
    try {
      for (const key of personalStorageKeys(Object.keys(store))) store.removeItem(key)
    } catch {
      // Storage blocked: nothing stored to clear.
    }
  }
  for (const name of PERSONAL_COOKIES) document.cookie = `${name}=; Path=/; Max-Age=0`
}

/**
 * Clears now, and again as the page unloads: stores flush on pagehide and on
 * hide (taste session, listening time), which would write the state back.
 * Added last, these listeners run after theirs.
 */
function signOutOfDevice(): void {
  clearPersonalState()
  window.addEventListener("pagehide", clearPersonalState)
  document.addEventListener("visibilitychange", clearPersonalState)
}

/** Me → Sign out: a form post, so it still works before the page hydrates. */
export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post" onSubmit={signOutOfDevice}>
      <button
        type="submit"
        className="h-9 rounded-full border border-border-strong px-3 text-footnote font-medium hover:bg-muted"
      >
        Sign out
      </button>
    </form>
  )
}

/**
 * Back after signing out can restore the signed-in page from the browser's
 * page cache (badge, fits, playing track). Reload it as the guest it now is.
 */
export function SignedOutRestoreGuard() {
  useEffect(() => {
    const signedInAtLoad = maybeSignedIn()
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted && signedInAtLoad && !maybeSignedIn()) window.location.reload()
    }
    window.addEventListener("pageshow", onShow)
    return () => window.removeEventListener("pageshow", onShow)
  }, [])
  return null
}
