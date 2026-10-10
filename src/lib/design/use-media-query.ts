"use client"

import { useSyncExternalStore } from "react"

/** SSR-safe media query: `serverValue` until hydrated, then live. */
export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener("change", onChange)
      return () => list.removeEventListener("change", onChange)
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  )
}
