"use client"

import { useEffect, useSyncExternalStore } from "react"

/**
 * Picks the single video card allowed to autoplay its muted preview: the
 * most visible one, and only if more than half of it is on screen (YouTube's
 * autoplay rule). Everything else shows its thumbnail.
 */
export const AUTOPLAY_VISIBLE_RATIO = 0.6

const ratios = new Map<string, number>()
const listeners = new Set<() => void>()
let active: string | null = null
let observer: IntersectionObserver | null = null
const elements = new Map<Element, string>()

function recompute() {
  let best: string | null = null
  let bestRatio = AUTOPLAY_VISIBLE_RATIO
  for (const [id, ratio] of ratios) {
    if (ratio >= bestRatio) {
      best = id
      bestRatio = ratio
    }
  }
  if (best === active) return
  active = best
  listeners.forEach((listener) => listener())
}

function getObserver() {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const id = elements.get(entry.target)
        if (id) ratios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0)
      }
      recompute()
    },
    { threshold: [0, 0.25, 0.5, 0.6, 0.75, 0.9, 1] },
  )
  return observer
}

/** Watches `element`; returns whether this card is the one that may autoplay. */
export function useInlinePreview(id: string, element: Element | null, enabled: boolean): boolean {
  useEffect(() => {
    if (!element || !enabled) return
    const io = getObserver()
    elements.set(element, id)
    io.observe(element)
    return () => {
      io.unobserve(element)
      elements.delete(element)
      ratios.delete(id)
      recompute()
    }
  }, [id, element, enabled])

  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => active,
    () => null,
  )
  return enabled && current === id
}

function readAutoplayAllowed(): boolean {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return !reduce && connection?.saveData !== true
}

/** Autoplaying previews are skipped for reduced motion and data-saver users. */
export function useAutoplayAllowed(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    readAutoplayAllowed,
    () => false,
  )
}
