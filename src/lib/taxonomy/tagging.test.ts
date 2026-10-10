import { describe, expect, it } from "vitest"
import type { FeedItem } from "@/lib/feed/types"
import { tagFeedItems } from "./tagging"

const item = (id: string, title: string, subtitle: string | null = null): FeedItem => ({
  id,
  source: "youtube",
  type: "video",
  title,
  subtitle,
  imageUrl: null,
  url: `https://example.com/${id}`,
  publishedAt: null,
  score: 1,
  meta: {},
})

const TAGS = [
  { slug: "fit-pics", name: "fit pics", keywords: ["fit check", "outfit"] },
  { slug: "drops", name: "streetwear drops", keywords: ["drop", "restock"] },
  { slug: "memes", name: "memes", keywords: ["meme"] },
]

describe("tagFeedItems", () => {
  it("labels items by whole-word keyword matches in title or subtitle", () => {
    const { items } = tagFeedItems(
      [
        item("a", "OSAMASON FIT CHECK"),
        item("b", "Hellstar", "new drop this friday"),
        item("c", "outfitters haul"),
      ],
      TAGS,
    )
    expect(items.map((entry) => entry.tags)).toEqual([["fit-pics"], ["drops"], []])
  })

  it("only returns tags that matched something", () => {
    const { tags } = tagFeedItems([item("a", "outfit ideas")], TAGS)
    expect(tags).toEqual([{ slug: "fit-pics", name: "fit pics" }])
  })

  it("handles no tags and no items", () => {
    expect(tagFeedItems([], TAGS)).toEqual({ items: [], tags: [] })
    expect(tagFeedItems([item("a", "x")], []).tags).toEqual([])
  })
})
