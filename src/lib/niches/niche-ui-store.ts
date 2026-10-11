"use client"

import { useSyncExternalStore } from "react"

/**
 * Page-level state for the open niche: the palette swatch the listener picked
 * (re-tints the page and filters the moodboard and shop) and tab requests
 * from elsewhere on the page ("shop this color" jumps to the shop).
 */
export interface NicheUiState {
  slug: string | null
  swatch: string | null
  requestedTab: { id: string; at: number } | null
}

const listeners = new Set<() => void>()
let state: NicheUiState = { slug: null, swatch: null, requestedTab: null }

function emit(next: Partial<NicheUiState>) {
  state = { ...state, ...next }
  listeners.forEach((listener) => listener())
}

/** Called by the niche page root: a new niche starts untinted. */
export function enterNiche(slug: string): void {
  if (state.slug !== slug) emit({ slug, swatch: null, requestedTab: null })
}

export function setSwatch(swatch: string | null): void {
  emit({ swatch })
}

export function requestTab(id: string): void {
  emit({ requestedTab: { id, at: Date.now() } })
}

export function useNicheUi(): NicheUiState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
    () => state,
  )
}
