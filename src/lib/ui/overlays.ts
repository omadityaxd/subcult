"use client"

import { useEffect, useSyncExternalStore } from "react"

/**
 * Which full-attention layers are open (bottom sheets, dialogs, the search
 * palette, stories, the Reels viewer, Wrapped). While any is open the
 * mini-player hides, so it never sits on top of them or their buttons.
 */
export function createOverlayRegistry() {
  const open = new Set<string>()
  const listeners = new Set<() => void>()
  const emit = () => {
    for (const listener of listeners) listener()
  }
  return {
    set(id: string, isOpen: boolean) {
      const had = open.has(id)
      if (isOpen) open.add(id)
      else open.delete(id)
      if (had !== isOpen) emit()
    },
    anyOpen: () => open.size > 0,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

const registry = createOverlayRegistry()
let nextId = 0

/** Marks this component's overlay as open while `isOpen` (and while mounted). */
export function useOverlay(isOpen: boolean): void {
  useEffect(() => {
    if (!isOpen) return
    const id = `overlay-${nextId++}`
    registry.set(id, true)
    return () => registry.set(id, false)
  }, [isOpen])
}

/** Is any overlay open right now? */
export function useAnyOverlayOpen(): boolean {
  return useSyncExternalStore(registry.subscribe, registry.anyOpen, () => false)
}
