"use client"

import { useSyncExternalStore } from "react"

function subscribe(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange)
  return () => document.removeEventListener("visibilitychange", onChange)
}

/**
 * Is the page hidden (another tab, the app switcher, a locked phone)?
 * Stories and previews pause on it; music the listener chose keeps going so
 * the lock screen controls it.
 */
export function usePageHidden(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.visibilityState === "hidden",
    () => false,
  )
}
