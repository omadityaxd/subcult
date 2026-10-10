import { describe, expect, it } from "vitest"
import { type SavedItem, toggleSave } from "./saves"

const item = {
  id: "spotify:track:1",
  title: "Holocene",
  url: "https://x",
  imageUrl: null,
  source: "spotify",
  subtitle: null,
}

describe("toggleSave", () => {
  it("adds newest first, then removes on the second toggle", () => {
    const older: SavedItem = { ...item, id: "old", savedAt: 1 }
    const saved = toggleSave([older], item, 5)
    expect(saved.map((s) => s.id)).toEqual(["spotify:track:1", "old"])
    expect(saved[0].savedAt).toBe(5)
    expect(toggleSave(saved, item, 6).map((s) => s.id)).toEqual(["old"])
  })

  it("caps the list size", () => {
    const many: SavedItem[] = Array.from({ length: 500 }, (_, i) => ({
      ...item,
      id: `i${i}`,
      savedAt: i,
    }))
    expect(toggleSave(many, item, 999)).toHaveLength(500)
  })
})
