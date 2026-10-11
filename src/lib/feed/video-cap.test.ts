import { describe, expect, it } from "vitest"
import type { FeedItem } from "./types"
import { capVideos, storyOrder } from "./video-cap"

const item = (
  id: string,
  type: FeedItem["type"],
  source: FeedItem["source"],
  image = true,
): FeedItem => ({
  id,
  source,
  type,
  title: id,
  subtitle: null,
  imageUrl: image ? `https://img/${id}` : null,
  url: `https://x/${id}`,
  publishedAt: null,
  score: 1,
  meta: {},
})

describe("capVideos", () => {
  it("keeps videos to at most 1 in 5 of the final list, in order", () => {
    const items = [
      item("v1", "video", "youtube"),
      item("v2", "video", "youtube"),
      item("v3", "video", "youtube"),
      ...Array.from({ length: 8 }, (_, i) => item(`t${i}`, "track", "spotify")),
    ]
    const capped = capVideos(items)
    const videos = capped.filter((i) => i.type === "video")
    expect(videos.map((v) => v.id)).toEqual(["v1", "v2"])
    expect(videos.length / capped.length).toBeLessThanOrEqual(0.2)
  })

  it("applies the cap to the trimmed list, not the full one", () => {
    const items = [
      item("v1", "video", "youtube"),
      item("v2", "video", "youtube"),
      item("v3", "video", "youtube"),
      ...Array.from({ length: 12 }, (_, i) => item(`n${i}`, "article", "news", false)),
    ]
    const capped = capVideos(items, 0.2, 10)
    expect(capped).toHaveLength(10)
    expect(capped.filter((i) => i.type === "video")).toHaveLength(2)
  })

  it("shows no videos when there's nothing else", () => {
    expect(capVideos([item("v1", "video", "youtube")])).toEqual([])
  })
})

describe("storyOrder", () => {
  it("leads with music, then visuals, then headlines, with video capped", () => {
    const order = storyOrder([
      item("news", "article", "news", false),
      item("v1", "video", "youtube"),
      item("v2", "video", "youtube"),
      item("t1", "track", "spotify"),
      item("t2", "track", "spotify"),
      item("t3", "track", "spotify"),
      item("t4", "track", "spotify"),
    ])
    expect(order.map((i) => i.id)).toEqual(["t1", "t2", "t3", "t4", "v1", "news"])
  })
})
