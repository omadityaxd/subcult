import { describe, expect, it } from "vitest"
import { interleave, nicheKeywords, rankFeed, recencyDecay, relevance, scoreItem } from "./rank"
import type { FeedItem, FeedSource } from "./types"

const NOW = new Date("2026-10-10T12:00:00Z")
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString()

const item = (overrides: Partial<FeedItem> = {}): FeedItem => ({
  id: "news:article:1",
  source: "news",
  type: "article",
  title: "untitled",
  subtitle: null,
  imageUrl: null,
  url: "https://example.com",
  publishedAt: hoursAgo(0),
  score: 0,
  meta: {},
  ...overrides,
})

const keywords = nicheKeywords({
  name: "gorpcore",
  vibeWords: ["technical", "earthy", "UT"],
  artists: [{ name: "Bon Iver", why: "" }],
  brands: [{ name: "Arc'teryx", priceTier: "$$$", why: "" }],
})

describe("nicheKeywords", () => {
  it("normalizes, dedupes and drops tiny words", () => {
    expect(keywords).toEqual(["gorpcore", "technical", "earthy", "bon iver", "arc teryx"])
  })
})

describe("relevance", () => {
  it("scales from 0.4 (no hits) to 1.0 (two or more hits)", () => {
    expect(relevance(item({ source: "spotify", title: "weather report" }), keywords)).toBeCloseTo(
      0.4,
    )
    expect(relevance(item({ title: "Gorpcore is back" }), keywords)).toBeCloseTo(0.7)
    expect(
      relevance(item({ title: "Arc'teryx drives gorpcore", subtitle: "earthy" }), keywords),
    ).toBeCloseTo(1)
  })

  it("demotes off-topic news and videos (no keyword hits)", () => {
    expect(relevance(item({ title: "weather report" }), keywords)).toBeCloseTo(0.15)
    expect(
      relevance(item({ source: "youtube", title: "leather jacket haul" }), keywords),
    ).toBeCloseTo(0.15)
  })

  it("matches whole words only", () => {
    expect(
      relevance(item({ source: "spotify", title: "earthyness unrelated" }), keywords),
    ).toBeCloseTo(0.4)
  })
})

describe("recencyDecay", () => {
  it("halves every half-life", () => {
    expect(recencyDecay(item({ publishedAt: hoursAgo(0) }), NOW)).toBeCloseTo(1)
    expect(recencyDecay(item({ publishedAt: hoursAgo(48) }), NOW)).toBeCloseTo(0.5)
    expect(recencyDecay(item({ publishedAt: hoursAgo(96) }), NOW)).toBeCloseTo(0.25)
  })

  it("treats spotify and undated items as timeless", () => {
    expect(recencyDecay(item({ source: "spotify", publishedAt: hoursAgo(5000) }), NOW)).toBe(0.7)
    expect(recencyDecay(item({ publishedAt: null }), NOW)).toBe(0.7)
  })
})

describe("scoreItem / rankFeed", () => {
  it("multiplies the four factors", () => {
    // relevance 0.7 × recency 0.5 × news weight 0.8 × (1 + 0.5)
    const scored = scoreItem(item({ title: "gorpcore", publishedAt: hoursAgo(48) }), {
      keywords,
      now: NOW,
      feedback: new Map([["news:article:1", 0.5]]),
    })
    expect(scored).toBeCloseTo(0.7 * 0.5 * 0.8 * 1.5)
  })

  it("drops items feedback marked 'not my vibe' and sorts best-first", () => {
    const ranked = rankFeed(
      [
        item({ id: "a", title: "old news", publishedAt: hoursAgo(200) }),
        item({ id: "b", title: "gorpcore technical", publishedAt: hoursAgo(1) }),
        item({ id: "c", title: "hidden" }),
      ],
      { keywords, now: NOW, feedback: new Map([["c", -1]]) },
    )
    expect(ranked.map((r) => r.id)).toEqual(["b", "a"])
  })
})

describe("interleave", () => {
  const run = (sources: FeedSource[]) =>
    interleave(sources.map((source, i) => item({ id: String(i), source }))).map((i) => i.source[0])

  it("never allows more than two in a row from one source", () => {
    // Runs of news are capped at 2; within that, score order is preserved.
    expect(run(["news", "news", "news", "news", "youtube", "spotify"]).join("")).toBe("nnynns")
  })

  it("keeps order when sources already alternate, and tolerates a single source", () => {
    expect(run(["news", "youtube", "news"]).join("")).toBe("nyn")
    expect(run(["news", "news", "news"]).join("")).toBe("nnn")
  })
})
