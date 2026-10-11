import { describe, expect, it } from "vitest"
import { assembleBoard, moodboardFeedItems, pinsNearColor, similarPins } from "./board"
import type { Pin, PinSource } from "./types"

const pin = (id: string, source: PinSource, color: string | null): Pin => ({
  id,
  source,
  imageUrl: `https://img/${id}.jpg`,
  largeUrl: `https://img/${id}-l.jpg`,
  width: 400,
  height: 500,
  color,
  title: id,
  credit: null,
  pageUrl: `https://src/${id}`,
})

describe("assembleBoard", () => {
  it("round-robins sources and drops duplicate images", () => {
    const board = assembleBoard([
      [pin("a1", "arena", null), pin("a2", "arena", null)],
      [
        pin("u1", "unsplash", null),
        { ...pin("dup", "unsplash", null), imageUrl: "https://img/a1.jpg" },
      ],
    ])
    expect(board.map((p) => p.id)).toEqual(["a1", "u1", "a2"])
  })
})

describe("color filtering", () => {
  const pins = [
    pin("red", "arena", "#a31f34"),
    pin("rust", "arena", "#8a2a1f"),
    pin("blue", "arena", "#1f6fa3"),
    pin("none", "arena", null),
  ]

  it("keeps pins near the swatch, closest first", () => {
    expect(pinsNearColor(pins, "#a31f34").map((p) => p.id)).toEqual(["red", "rust"])
  })

  it("ranks 'more like this' by color", () => {
    expect(similarPins(pins, pins[0])[0].id).toBe("rust")
  })
})

describe("moodboardFeedItems", () => {
  it("puts external pins in the feed and keeps our own imagery on the board", () => {
    const items = moodboardFeedItems([pin("a", "arena", "#000000"), pin("al", "album", null)])
    expect(items.map((item) => item.source)).toEqual(["arena"])
    expect(items[0].type).toBe("pin")
  })
})
