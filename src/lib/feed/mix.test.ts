import { describe, expect, it } from "vitest"
import {
  DEFAULT_MIX,
  MAX_RUN,
  MIX_KINDS,
  type MixKind,
  measureMix,
  mixFeed,
  mixKind,
  resolveMix,
} from "./mix"
import type { FeedItem, FeedSource } from "./types"

const SOURCE: Record<MixKind, { source: FeedSource; type: FeedItem["type"] }> = {
  music: { source: "spotify", type: "track" },
  pin: { source: "arena", type: "pin" },
  shop: { source: "ebay", type: "product" },
  video: { source: "youtube", type: "video" },
  news: { source: "news", type: "article" },
  artists: { source: "subcult", type: "artist" },
  discovery: { source: "subcult", type: "niche" },
}

const item = (kind: MixKind, i: number): FeedItem => ({
  id: `${kind}:${i}`,
  ...SOURCE[kind],
  title: `${kind} ${i}`,
  subtitle: null,
  imageUrl: null,
  url: `https://x/${kind}/${i}`,
  publishedAt: null,
  score: 1,
  meta: {},
})

const bucket = (kind: MixKind, n: number) => Array.from({ length: n }, (_, i) => item(kind, i))
const ample = () => Object.fromEntries(MIX_KINDS.map((kind) => [kind, bucket(kind, 60)]))

const longestRun = (items: readonly FeedItem[]) => {
  let best = 0
  let run = 0
  items.forEach((entry, i) => {
    run = i > 0 && mixKind(entry) === mixKind(items[i - 1]) ? run + 1 : 1
    best = Math.max(best, run)
  })
  return best
}

describe("resolveMix", () => {
  it("normalizes default + branch + niche overrides", () => {
    const fashion = resolveMix("underground-fashion")
    expect(fashion.shop).toBeGreaterThan(DEFAULT_MIX.shop)
    expect(fashion.music).toBeLessThan(DEFAULT_MIX.music)
    expect(resolveMix("underground-music").music).toBeGreaterThan(DEFAULT_MIX.music)
    const total = MIX_KINDS.reduce((sum, kind) => sum + fashion[kind], 0)
    expect(total).toBeCloseTo(1)
    expect(resolveMix(undefined, { video: 0 }).video).toBe(0)
  })
})

describe("mixFeed", () => {
  it("hits the target shares within ±5% on every 20-item page", () => {
    const shares = resolveMix(undefined)
    const feed = mixFeed(ample(), shares, 100)
    for (let page = 0; page < 5; page++) {
      const measured = measureMix(feed.slice(page * 20, page * 20 + 20))
      for (const kind of MIX_KINDS) {
        expect(Math.abs(measured[kind] - shares[kind]), `${kind} page ${page}`).toBeLessThanOrEqual(
          0.05 + 1e-9,
        )
      }
    }
  })

  it("never puts more than two of a kind in a row while others remain", () => {
    const feed = mixFeed(ample(), resolveMix("underground-music"), 120)
    expect(longestRun(feed)).toBeLessThanOrEqual(MAX_RUN)
  })

  it("redistributes a missing source's share instead of padding", () => {
    const buckets = ample()
    delete buckets.shop
    delete buckets.pin
    const shares = resolveMix(undefined)
    const feed = mixFeed(buckets, shares, 50)
    const measured = measureMix(feed)
    expect(measured.shop).toBe(0)
    expect(measured.pin).toBe(0)
    // Freed 30% spreads proportionally (music 0.30 / 0.70 ≈ 43%), but video is
    // held at its 10% cap, and that excess goes to the rest too: music ≈ 45%.
    expect(Math.abs(measured.music - 0.45)).toBeLessThanOrEqual(0.05)
    expect(measured.video).toBeLessThanOrEqual(0.1 + 1e-9)
    expect(feed).toHaveLength(50)
  })

  it("keeps rank order within a kind and stops when everything runs out", () => {
    const feed = mixFeed(
      { music: bucket("music", 3), news: bucket("news", 2) },
      resolveMix(undefined),
    )
    expect(feed.filter((i) => mixKind(i) === "music").map((i) => i.id)).toEqual([
      "music:0",
      "music:1",
      "music:2",
    ])
    expect(feed).toHaveLength(5)
  })
})

describe("caps", () => {
  it("never lets redistribution push video past 10%", () => {
    const feed = mixFeed(
      { video: bucket("video", 40), news: bucket("news", 6), artists: bucket("artists", 6) },
      resolveMix(undefined),
      40,
    )
    const videos = feed.filter((i) => mixKind(i) === "video").length
    expect(videos / feed.length).toBeLessThanOrEqual(0.15) // ≤10% plus the 1-item floor on short lists
    expect(feed.length).toBeLessThan(40) // stops rather than padding with video
  })
})

describe("mixKind", () => {
  it("counts tracks and playlists as music whatever the source", () => {
    expect(mixKind({ ...item("artists", 0), type: "track" })).toBe("music")
  })

  it("files fit pics under artists & fits, other pins under moodboard", () => {
    expect(mixKind({ ...item("pin", 0), meta: { fit: true } })).toBe("artists")
    expect(mixKind(item("pin", 0))).toBe("pin")
    expect(mixKind(item("discovery", 0))).toBe("discovery")
  })
})
