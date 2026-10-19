import { describe, expect, it } from "vitest"
import type { FeedItem } from "@/lib/feed/types"
import type { ImageFacts } from "./analyze"
import { dedupeImages, fitsSlot, focusOf, withImageFacts } from "./curate"

const facts = (width: number, hash: string): ImageFacts => ({
  width,
  height: width,
  hash,
  focusX: 0.8,
  focusY: 0.25,
})

const item = (id: string, imageUrl: string | null): FeedItem => ({
  id,
  source: "news",
  type: "article",
  title: id,
  subtitle: null,
  imageUrl,
  url: `https://x.com/${id}`,
  publishedAt: null,
  score: 1,
  meta: {},
})

describe("image curation", () => {
  it("lets only sharp images into hero and cover slots", () => {
    const map = new Map([
      ["https://a.com/big.jpg", facts(1600, "0000000000000000")],
      ["https://a.com/small.jpg", facts(564, "ffffffffffffffff")],
    ])
    expect(fitsSlot("https://a.com/big.jpg", "cover", map)).toBe(true)
    expect(fitsSlot("https://a.com/small.jpg", "cover", map)).toBe(false)
    expect(fitsSlot("https://a.com/unknown.jpg", "cover", map)).toBe(false)
    expect(fitsSlot("https://i.ytimg.com/vi/x/hqdefault.jpg", "card")).toBe(false)
    expect(fitsSlot("https://i.ytimg.com/vi/x/maxresdefault.jpg", "cover")).toBe(true)
  })

  it("drops the same artwork at another size and near-identical copies", () => {
    const map = new Map([
      ["https://a.com/1.jpg", facts(800, "f0f0f0f0f0f0f0f0")],
      ["https://b.com/copy.jpg", facts(800, "f0f0f0f0f0f0f0f1")],
      ["https://c.com/other.jpg", facts(800, "0f0f0f0f0f0f0f0f")],
    ])
    const items = [
      item("album-640", "https://i.scdn.co/image/ab67616d0000b2734eba3a1d0a6f9a7a1b2c3d4e"),
      item("album-300", "https://i.scdn.co/image/ab67616d00001e024eba3a1d0a6f9a7a1b2c3d4e"),
      item("one", "https://a.com/1.jpg"),
      item("copy", "https://b.com/copy.jpg"),
      item("other", "https://c.com/other.jpg"),
      item("text", null),
    ]
    expect(dedupeImages(items, (i) => i.imageUrl, map).map((i) => i.id)).toEqual([
      "album-640",
      "one",
      "other",
      "text",
    ])
  })

  it("carries the subject's position onto the item", () => {
    const map = new Map([["https://a.com/1.jpg", facts(800, "0000000000000000")]])
    const out = withImageFacts(item("one", "https://a.com/1.jpg"), map)
    expect(focusOf(out)).toBe("80% 25%")
    expect(focusOf(item("bare", null))).toBeUndefined()
  })
})
