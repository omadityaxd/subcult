"use client"

import { useSyncExternalStore } from "react"
import { z } from "zod"

/**
 * The latest Vibe Check result, on this device until accounts land (Phase 6
 * moves it to the account, next to saves and follows). Every storage access
 * is guarded: private mode or blocked storage just means nothing is remembered.
 */
const STORAGE_KEY = "subcult-vibe-v1"

const resultSchema = z.object({
  mix: z
    .array(z.object({ slug: z.string(), percent: z.number() }))
    .min(1)
    .max(3),
  blurb: z.string(),
  takenAt: z.number(),
})
export type VibeResult = z.infer<typeof resultSchema>

const listeners = new Set<() => void>()
let cachedRaw: string | null = null
let cachedValue: VibeResult | null = null

function read(): VibeResult | null {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
  // Same string → same object, so useSyncExternalStore doesn't loop.
  if (raw === cachedRaw) return cachedValue
  cachedRaw = raw
  try {
    const parsed = resultSchema.safeParse(raw ? JSON.parse(raw) : null)
    cachedValue = parsed.success ? parsed.data : null
  } catch {
    cachedValue = null
  }
  return cachedValue
}

export function saveVibeResult(result: VibeResult): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result))
  } catch {
    // Not remembered, but the result screen still shows.
  }
  listeners.forEach((listener) => listener())
}

export function clearVibeResult(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing stored to clear.
  }
  listeners.forEach((listener) => listener())
}

export function useVibeResult(): VibeResult | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    read,
    () => null,
  )
}
