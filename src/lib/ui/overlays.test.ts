import { describe, expect, it, vi } from "vitest"
import {
  OVERLAY_STATE_KEY,
  createOverlayRegistry,
  isInAppNavigation,
  shouldReplaceOverlayEntry,
} from "./overlays"

describe("overlay registry", () => {
  it("is open while any overlay is open, and tells listeners when that changes", () => {
    const registry = createOverlayRegistry()
    const listener = vi.fn()
    registry.subscribe(listener)
    expect(registry.anyOpen()).toBe(false)

    registry.set("sheet", true)
    registry.set("story", true)
    expect(registry.anyOpen()).toBe(true)
    registry.set("sheet", false)
    expect(registry.anyOpen()).toBe(true) // the story is still up
    registry.set("story", false)
    expect(registry.anyOpen()).toBe(false)
    expect(listener).toHaveBeenCalledTimes(4)
  })

  it("ignores repeats (no extra renders)", () => {
    const registry = createOverlayRegistry()
    const listener = vi.fn()
    registry.subscribe(listener)
    registry.set("sheet", true)
    registry.set("sheet", true)
    registry.set("other", false)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe("leaving an overlay by a link", () => {
  const here = new URL("https://subcult.app/n/rage")
  const tap = { target: null, download: false, button: 0, modified: false }

  it("counts a plain tap on another page of the app", () => {
    expect(isInAppNavigation({ ...tap, href: "/n/vamp" }, here)).toBe(true)
    expect(isInAppNavigation({ ...tap, href: "/n/rage?tab=fits" }, here)).toBe(true)
    expect(isInAppNavigation({ ...tap, href: "https://subcult.app/me" }, here)).toBe(true)
  })

  it("ignores taps that don't navigate this tab", () => {
    expect(isInAppNavigation({ ...tap, href: "https://open.spotify.com/artist/1" }, here)).toBe(false)
    expect(isInAppNavigation({ ...tap, href: "/n/vamp", target: "_blank" }, here)).toBe(false)
    expect(isInAppNavigation({ ...tap, href: "/n/vamp", modified: true }, here)).toBe(false)
    expect(isInAppNavigation({ ...tap, href: "/n/vamp", button: 1 }, here)).toBe(false)
    expect(isInAppNavigation({ ...tap, href: "/n/vamp", download: true }, here)).toBe(false)
    expect(isInAppNavigation({ ...tap, href: "/n/rage" }, here)).toBe(false) // same page
    expect(isInAppNavigation({ ...tap, href: "/n/rage#artists" }, here)).toBe(false)
    expect(isInAppNavigation({ ...tap, href: null }, here)).toBe(false)
  })

  it("replaces an overlay's history entry with the new page instead of stacking on it", () => {
    const overlay = { __NA: true, [OVERLAY_STATE_KEY]: "overlay-3" }
    expect(shouldReplaceOverlayEntry(overlay, "/n/vamp")).toBe(true)
    // A second overlay opening on top adds its own same-page entry.
    expect(shouldReplaceOverlayEntry(overlay, "")).toBe(false)
    expect(shouldReplaceOverlayEntry(overlay, undefined)).toBe(false)
    // Ordinary pages keep normal pushes.
    expect(shouldReplaceOverlayEntry({ __NA: true }, "/n/vamp")).toBe(false)
    expect(shouldReplaceOverlayEntry(null, "/n/vamp")).toBe(false)
  })
})
