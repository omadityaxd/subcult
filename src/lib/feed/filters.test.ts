import { describe, expect, it } from "vitest"
import { applyFilter, filterOf } from "./filters"
import type { FeedItem } from "./types"

const item = (over: Partial<FeedItem>): FeedItem => ({
  id: "x",
  source: "subcult",
  type: "niche",
  title: "t",
  subtitle: null,
  imageUrl: null,
  url: "/",
  publishedAt: null,
  score: 1,
  meta: {},
  ...over,
})

describe("For You filters", () => {
  it("sorts every kind of card under one chip", () => {
    expect(filterOf(item({ source: "ebay", type: "product" }))).toBe("archive")
    expect(filterOf(item({ type: "brand" }))).toBe("brands")
    expect(filterOf(item({ type: "fit" }))).toBe("fits")
    expect(filterOf(item({ source: "arena", type: "pin" }))).toBe("fits")
    expect(filterOf(item({ type: "pin", meta: { artistSlug: "che" } }))).toBe("scenes")
    expect(filterOf(item({ source: "spotify", type: "track" }))).toBe("sounds")
    expect(filterOf(item({ source: "news", type: "article" }))).toBe("scenes")
    expect(filterOf(item({ source: "youtube", type: "video" }))).toBe("scenes")
  })

  it("All keeps everything; a chip narrows", () => {
    const items = [item({ type: "brand" }), item({ source: "spotify", type: "track" })]
    expect(applyFilter(items, "all")).toHaveLength(2)
    expect(applyFilter(items, "brands")).toHaveLength(1)
  })
})
