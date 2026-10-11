"use client"

import { useSyncExternalStore } from "react"

let snapshot: number | null = null
const noop = () => () => undefined

/**
 * A stable "now" for client-only date maths (null while prerendering, where
 * reading the clock isn't allowed). Fixed for the life of the page view.
 */
export function useClientNow(): number | null {
  return useSyncExternalStore(
    noop,
    () => (snapshot ??= Date.now()),
    () => null,
  )
}
