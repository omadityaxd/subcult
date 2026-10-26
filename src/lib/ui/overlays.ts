"use client"

import { useEffect, useRef, useSyncExternalStore } from "react"

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

/** The history entry an open overlay adds (same URL), so Back closes it. */
export const OVERLAY_STATE_KEY = "subcultOverlay"

/** How long after a link tap or `markNavigation()` a close counts as "navigating away". */
const NAVIGATION_WINDOW_MS = 1000

interface LinkClick {
  href: string | null
  target: string | null
  download: boolean
  button: number
  modified: boolean
}

/** A plain tap on a link to another page of this app (the router will navigate). */
export function isInAppNavigation(click: LinkClick, current: URL): boolean {
  if (!click.href || click.download || click.button !== 0 || click.modified) return false
  if (click.target && click.target !== "_self") return false
  const to = new URL(click.href, current)
  return (
    to.origin === current.origin && to.pathname + to.search !== current.pathname + current.search
  )
}

/**
 * A navigation leaving an overlay's history entry takes that entry's place,
 * so Back from the new page returns straight to the page under the overlay.
 */
export function shouldReplaceOverlayEntry(
  state: unknown,
  url: string | URL | null | undefined,
): boolean {
  return (
    url != null &&
    url !== "" &&
    typeof state === "object" &&
    state !== null &&
    OVERLAY_STATE_KEY in state
  )
}

let navigationAt = -Infinity
/** Call right before a programmatic navigation that also closes an overlay. */
export function markNavigation(): void {
  navigationAt = performance.now()
}
const navigating = () => performance.now() - navigationAt < NAVIGATION_WINDOW_MS

/**
 * Pops we cause ourselves when an overlay closes another way. The entry has
 * the page's own URL, so nothing needs restoring and the router must not
 * see it (at-target capture listeners run before the router's own).
 */
let ownPops = 0

if (typeof window !== "undefined") {
  window.addEventListener(
    "popstate",
    (event) => {
      if (ownPops === 0) return
      ownPops -= 1
      event.stopImmediatePropagation()
    },
    { capture: true },
  )
  document.addEventListener(
    "click",
    (event) => {
      const link = event.target instanceof Element ? event.target.closest("a") : null
      if (!link) return
      const click: LinkClick = {
        href: link.getAttribute("href"),
        target: link.getAttribute("target"),
        download: link.hasAttribute("download"),
        button: event.button,
        modified: event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
      }
      if (isInAppNavigation(click, new URL(window.location.href))) markNavigation()
    },
    { capture: true },
  )
  // The router writes history through this; swap a push off an overlay entry for a replace.
  const push = window.history.pushState.bind(window.history)
  window.history.pushState = function pushState(data, unused, url) {
    if (shouldReplaceOverlayEntry(window.history.state, url)) {
      return window.history.replaceState(data, unused, url)
    }
    return push(data, unused, url)
  }
}

/**
 * Marks this component's overlay as open while `isOpen` (and while mounted).
 * With `onClose`, the overlay also owns a history entry: the back gesture or
 * button closes it instead of leaving the page. Closing it any other way
 * removes that entry again, unless a navigation is under way (going back
 * would cancel it; the new page replaces the entry instead).
 */
export function useOverlay(isOpen: boolean, onClose?: () => void): void {
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])
  const withHistory = onClose !== undefined

  useEffect(() => {
    if (!isOpen) return
    const id = `overlay-${nextId++}`
    registry.set(id, true)
    if (!withHistory) return () => registry.set(id, false)

    let pushed = false
    let poppedByBack = false
    // Deferred a tick: React's dev double-mount must not leave stray entries.
    const timer = window.setTimeout(() => {
      pushOverlayEntry(id)
      pushed = true
    }, 0)
    const onPop = () => {
      if (!pushed || window.history.state?.[OVERLAY_STATE_KEY] === id) return
      poppedByBack = true
      close.current?.()
    }
    window.addEventListener("popstate", onPop)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("popstate", onPop)
      registry.set(id, false)
      const ours = window.history.state?.[OVERLAY_STATE_KEY] === id
      // Closed by a button or Escape: drop our entry so Back doesn't need two presses.
      if (pushed && !poppedByBack && ours && !navigating()) {
        ownPops += 1
        window.history.back()
      }
    }
  }, [isOpen, withHistory])
}

function pushOverlayEntry(id: string) {
  // No URL: an entry for the same page, which the router ignores.
  window.history.pushState({ ...window.history.state, [OVERLAY_STATE_KEY]: id }, "")
}

/** Is any overlay open right now? */
export function useAnyOverlayOpen(): boolean {
  return useSyncExternalStore(registry.subscribe, registry.anyOpen, () => false)
}
