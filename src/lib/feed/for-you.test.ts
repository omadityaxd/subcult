import { describe, expect, it } from "vitest"
import { artistCards, buildForYou, discoveryCards, nicheMix } from "./for-you"
import { MIX_KINDS, measureMix, mixKind } from "./mix"
import type { FeedItem, FeedSource } from "./types"

const fake = (source: FeedSource, type: FeedItem["type"], n: number): FeedItem[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${source}:${i}`,
    source,
    type,
    title: `${source} ${i}`,
    subtitle: null,
    imageUrl: null,
    url: `https://x/${source}/${i}`,
    publishedAt: null,
    score: 1,
    meta: {},
  }))

describe("For You builder", () => {
  it("turns verified artists into in-app artist cards", () => {
    const cards = artistCards("rage")
    expect(cards.length).toBeGreaterThan(0)
    expect(
      cards.every((c) => c.source === "subcult" && c.type === "artist" && c.url.startsWith("/")),
    ).toBe(true)
  })

  it("adds neighbouring niches and a vibe-check prompt as discovery", () => {
    const cards = discoveryCards("rage")
    expect(cards.some((c) => c.type === "prompt")).toBe(true)
    expect(cards.filter((c) => c.type === "niche").every((c) => c.url.startsWith("/n/"))).toBe(true)
  })

  it("uses the fashion mix for fashion niches and the music mix for music niches", () => {
    expect(nicheMix("vamp").shop).toBeGreaterThan(nicheMix("rage").shop)
    expect(nicheMix("rage").music).toBeGreaterThan(nicheMix("vamp").music)
  })

  it("mixes sources to the niche's shares, redistributing missing kinds", () => {
    const feed = buildForYou(
      "rage",
      {
        bySource: {
          spotify: fake("spotify", "track", 30),
          youtube: fake("youtube", "video", 10),
          news: fake("news", "article", 10),
        },
      },
      {},
      20,
    )
    const measured = measureMix(feed)
    expect(measured.pin).toBe(0)
    expect(measured.shop).toBe(0)
    expect(feed).toHaveLength(20)
    // Music niches lead with music.
    const top = [...MIX_KINDS].sort((a, b) => measured[b] - measured[a])[0]
    expect(top).toBe("music")
    expect(feed.slice(0, 3).some((item) => mixKind(item) === "music")).toBe(true)
  })
})
