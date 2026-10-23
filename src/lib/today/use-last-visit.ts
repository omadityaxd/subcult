"use client"

import { useSyncExternalStore } from "react"
import { touchVisit } from "./visits"

let snapshot: { value: number | null } | undefined
const noop = () => () => undefined

/**
 * When this device last visited, read (and the marker moved) once per page
 * load. `undefined` while prerendering and hydrating, so the server's HTML
 * and the first client render match; the real value arrives right after.
 * `null` = no earlier visit.
 */
export function useLastVisit(): number | null | undefined {
  return useSyncExternalStore(
    noop,
    () => (snapshot ??= { value: touchVisit() }).value,
    () => undefined,
  )
}
