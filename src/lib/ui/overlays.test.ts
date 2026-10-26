import { describe, expect, it, vi } from "vitest"
import { createOverlayRegistry } from "./overlays"

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
