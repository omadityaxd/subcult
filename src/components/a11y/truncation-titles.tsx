"use client"

import { useEffect } from "react"

const TRUNCATED = '.truncate, [class*="line-clamp-"]'
const AUTO = "data-auto-title"

/** Whether the element's text is actually cut off right now. */
const isCut = (el: HTMLElement) =>
  el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1

/** The truncated elements at an event target: itself, its ancestors and (for focus) its children. */
function truncatedAt(target: EventTarget | null): HTMLElement[] {
  if (!(target instanceof HTMLElement)) return []
  const own = target.closest<HTMLElement>(TRUNCATED)
  const inner = [...target.querySelectorAll<HTMLElement>(TRUNCATED)]
  return own ? [own, ...inner] : inner
}

function reveal(target: EventTarget | null): void {
  for (const el of truncatedAt(target)) {
    // Never override a title someone wrote on purpose.
    if (el.title && !el.hasAttribute(AUTO)) continue
    const text = el.textContent?.trim() ?? ""
    if (text && isCut(el)) {
      el.title = text
      el.setAttribute(AUTO, "")
    }
  }
}

function conceal(target: EventTarget | null): void {
  for (const el of truncatedAt(target)) {
    if (!el.hasAttribute(AUTO)) continue
    el.removeAttribute("title")
    el.removeAttribute(AUTO)
  }
}

/**
 * No text is cut off without a way to read it: hovering or focusing a
 * truncated or line-clamped text shows its full text as a native tooltip.
 * The title is added only for that moment (and only when the text really
 * overflows), so server-rendered HTML is never changed before React
 * hydrates it. Mounted once in the root layout.
 */
export function TruncationTitles() {
  useEffect(() => {
    const over = (event: Event) => reveal(event.target)
    const out = (event: Event) => conceal(event.target)
    document.addEventListener("pointerover", over, { passive: true })
    document.addEventListener("pointerout", out, { passive: true })
    document.addEventListener("focusin", over)
    document.addEventListener("focusout", out)
    return () => {
      document.removeEventListener("pointerover", over)
      document.removeEventListener("pointerout", out)
      document.removeEventListener("focusin", over)
      document.removeEventListener("focusout", out)
    }
  }, [])
  return null
}
