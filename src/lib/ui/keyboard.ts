"use client"

import { useSyncExternalStore } from "react"

/** The visual viewport shrinking by more than this, with a text field focused, is the keyboard. */
const KEYBOARD_MIN_PX = 150

function isTextField(element: Element | null): boolean {
  if (!element) return false
  if (element instanceof HTMLTextAreaElement) return true
  if (element instanceof HTMLInputElement) {
    return !["checkbox", "radio", "button", "submit", "range", "file", "color"].includes(
      element.type,
    )
  }
  return element instanceof HTMLElement && element.isContentEditable
}

function snapshot(): boolean {
  const viewport = window.visualViewport
  if (!viewport || !isTextField(document.activeElement)) return false
  return window.innerHeight - viewport.height > KEYBOARD_MIN_PX
}

function subscribe(listener: () => void): () => void {
  const viewport = window.visualViewport
  viewport?.addEventListener("resize", listener)
  window.addEventListener("focusin", listener)
  window.addEventListener("focusout", listener)
  return () => {
    viewport?.removeEventListener("resize", listener)
    window.removeEventListener("focusin", listener)
    window.removeEventListener("focusout", listener)
  }
}

/** Is the on-screen keyboard up? (Phones; always false on desktop.) */
export function useKeyboardOpen(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}

const visibleHeight = () => Math.round(window.visualViewport?.height ?? window.innerHeight)

/**
 * The height left above the on-screen keyboard (the visual viewport). vh and
 * dvh ignore the keyboard on iPhone, so a list sized with them runs under it.
 */
export function useVisibleHeight(): number | null {
  return useSyncExternalStore(subscribe, visibleHeight, () => null)
}
