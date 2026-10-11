import { describe, expect, it } from "vitest"
import {
  DEFAULT_MIX,
  MAX_RUN,
  MIX_KINDS,
  type MixKind,
  WINDOW,
  liveTargets,
  maxWindowShare,
  measureMix,
  mixFeed,
  mixKind,
  resolveMix,
} from "./mix"
import type { FeedItem, FeedSource } from "./types"

const SOURCE: Record<MixKind, { source: FeedSource; type: FeedItem["type"] }> = {
  fashion: { source: "ebay", type: "product" },
  moodboard: { source: "arena", type: "pin" },
  music: { source: "spotify", type: "track" },
  video: { source: "youtube", type: "video" },
  news: { source: "news", type: "article" },
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
const ample = (): Partial<Record<MixKind, FeedItem[]>> =>
  Object.fromEntries(MIX_KINDS.map((kind) => [kind, bucket(kind, 80)]))

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
  it("is culture-first by default: fashion leads, music is the soundtrack", () => {
    expect(DEFAULT_MIX).toEqual({
      fashion: 0.35,
      moodboard: 0.2,
      music: 0.2,
      video: 0.1,
      news: 0.1,
      discovery: 0.05,
    })
    const total = MIX_KINDS.reduce((sum, kind) => sum + DEFAULT_MIX[kind], 0)
    expect(total).toBeCloseTo(1)
  })

  it("leans fashion niches further into fits and never raises music anywhere", () => {
    const fashion = resolveMix("underground-fashion")
    expect(fashion.fashion).toBeGreaterThan(DEFAULT_MIX.fashion)
    expect(fashion.music).toBeLessThanOrEqual(DEFAULT_MIX.music)
    expect(resolveMix("underground-music").music).toBeCloseTo(DEFAULT_MIX.music)
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
    const feed = mixFeed(ample(), resolveMix("underground-fashion"), 120)
    expect(longestRun(feed)).toBeLessThanOrEqual(MAX_RUN)
  })

  it("keeps rank order within a kind and stops when everything runs out", () => {
    const feed = mixFeed(
      { fashion: bucket("fashion", 3), moodboard: bucket("moodboard", 2) },
      DEFAULT_MIX,
    )
    expect(feed.filter((i) => mixKind(i) === "fashion").map((i) => i.id)).toEqual([
      "fashion:0",
      "fashion:1",
      "fashion:2",
    ])
    expect(feed).toHaveLength(5)
  })
})

describe("music is the soundtrack layer", () => {
  it("never exceeds 20% of any 20-item page, even when everything else is thin", () => {
    const feed = mixFeed(
      {
        music: bucket("music", 200),
        fashion: bucket("fashion", 6),
        news: bucket("news", 4),
        discovery: bucket("discovery", 3),
      },
      DEFAULT_MIX,
      60,
    )
    expect(maxWindowShare(feed, "music")).toBeLessThanOrEqual(0.2 + 1e-9)
    // Stops short rather than padding with music.
    expect(feed.length).toBeLessThan(60)
  })

  it("redistributes a missing source's share to fashion and moodboard, never to music", () => {
    const buckets = ample()
    delete buckets.video
    delete buckets.news
    const feed = mixFeed(buckets, DEFAULT_MIX, 100)
    const measured = measureMix(feed)
    expect(measured.music).toBeLessThanOrEqual(0.2 + 1e-9)
    // Freed 20% splits 35:20 over fashion and moodboard.
    expect(Math.abs(measured.fashion - (0.35 + 0.2 * (0.35 / 0.55)))).toBeLessThanOrEqual(0.05)
    expect(Math.abs(measured.moodboard - (0.2 + 0.2 * (0.2 / 0.55)))).toBeLessThanOrEqual(0.05)
  })

  it("liveTargets only sends freed share to visual kinds while any are live", () => {
    const targets = liveTargets(DEFAULT_MIX, ["fashion", "music", "news"])
    expect(targets.get("music")).toBeCloseTo(0.2)
    expect(targets.get("news")).toBeCloseTo(0.1)
    expect(targets.get("fashion")).toBeCloseTo(0.7)
  })

  it("falls back to the other non-music kinds when no visual kind is left", () => {
    const targets = liveTargets(DEFAULT_MIX, ["music", "news", "discovery"])
    expect(targets.get("music")).toBeCloseTo(0.2)
    expect((targets.get("news") ?? 0) + (targets.get("discovery") ?? 0)).toBeCloseTo(0.8)
  })
})

describe("caps", () => {
  it("keeps video within 10% of any window", () => {
    const feed = mixFeed(
      { video: bucket("video", 40), fashion: bucket("fashion", 30), news: bucket("news", 10) },
      DEFAULT_MIX,
      60,
    )
    expect(maxWindowShare(feed, "video")).toBeLessThanOrEqual(0.1 + 1e-9)
    expect(WINDOW).toBe(20)
  })
})

describe("mixKind", () => {
  it("counts tracks and playlists as music whatever the source", () => {
    expect(mixKind({ ...item("discovery", 0), type: "track" })).toBe("music")
  })

  it("files fits, brands, archive and fit pics under fashion; other pins under moodboard", () => {
    expect(mixKind({ ...item("discovery", 0), type: "fit" })).toBe("fashion")
    expect(mixKind({ ...item("discovery", 0), type: "brand" })).toBe("fashion")
    expect(mixKind(item("fashion", 0))).toBe("fashion")
    expect(mixKind({ ...item("moodboard", 0), meta: { fit: true } })).toBe("fashion")
    expect(mixKind(item("moodboard", 0))).toBe("moodboard")
    expect(mixKind({ ...item("discovery", 0), type: "artist" })).toBe("discovery")
  })
})
