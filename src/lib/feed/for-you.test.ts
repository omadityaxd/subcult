import { describe, expect, it } from "vitest"
import { artistCards, buildForYou, discoveryCards, nicheMix } from "./for-you"
import { MIX_KINDS, measureMix } from "./mix"
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

  it("uses the fashion mix for fashion niches; music stays capped everywhere", () => {
    expect(nicheMix("vamp").fashion).toBeGreaterThan(nicheMix("rage").fashion)
    expect(nicheMix("rage").music).toBeLessThanOrEqual(0.2)
    expect(nicheMix("vamp").music).toBeLessThanOrEqual(0.2)
  })

  it("leads with fashion and keeps music to the soundtrack share, even in a music niche", () => {
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
    expect(measured.moodboard).toBe(0)
    expect(measured.music).toBeLessThanOrEqual(0.2 + 1e-9)
    // Brand cards are always there: fashion is the largest kind.
    const top = [...MIX_KINDS].sort((a, b) => measured[b] - measured[a])[0]
    expect(top).toBe("fashion")
    expect(feed.some((item) => item.type === "brand")).toBe(true)
  })
})
