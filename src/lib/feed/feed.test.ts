import { describe, expect, it, vi } from "vitest"
import { makeDraft } from "@/lib/engine/test-fixtures"
import type { Logger } from "@/lib/log"
import { memoryStore } from "./cache"
import { buildNicheFeed } from "./feed"
import type { FeedItem, FeedSource, Fetcher } from "./types"

const logger: Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
const profile = { ...makeDraft(), slug: "gorpcore", schemaVersion: 1 as const }
const NOW = new Date("2026-10-10T12:00:00Z")

const items = (source: FeedSource, n: number): FeedItem[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${source}:x:${i}`,
    source,
    type: "article",
    title: `gorpcore ${source} ${i}`,
    subtitle: null,
    imageUrl: null,
    url: `https://example.com/${source}/${i}`,
    publishedAt: NOW.toISOString(),
    score: 0,
    meta: {},
  }))

const fetcher = (source: FeedSource, fetch: Fetcher["fetch"]): Fetcher => ({
  source,
  freshSeconds: 60,
  staleSeconds: 600,
  fetch,
})

describe("buildNicheFeed", () => {
  it("merges, ranks and interleaves every source", async () => {
    const feed = await buildNicheFeed(profile, {
      fetchers: [
        fetcher("news", async () => items("news", 4)),
        fetcher("youtube", async () => items("youtube", 2)),
      ],
      disabled: ["spotify"],
      cache: memoryStore(),
      logger,
      now: () => NOW,
    })

    expect(feed.items).toHaveLength(6)
    expect(feed.bySource.news).toHaveLength(4)
    expect(feed.statuses).toEqual(
      expect.arrayContaining([
        { source: "spotify", state: "disabled", count: 0, cache: null },
        expect.objectContaining({ source: "news", state: "ok", count: 4, cache: "miss" }),
      ]),
    )
  })

  it("degrades gracefully: a failing or hanging source doesn't break the feed", async () => {
    const feed = await buildNicheFeed(profile, {
      fetchers: [
        fetcher("news", async () => items("news", 2)),
        fetcher("youtube", async () => {
          throw new Error("403 quota")
        }),
        fetcher("spotify", () => new Promise<never>(() => undefined)),
      ],
      disabled: [],
      cache: memoryStore(),
      logger,
      now: () => NOW,
      timeoutMs: 20,
    })

    expect(feed.items.map((item) => item.source)).toEqual(["news", "news"])
    const states = Object.fromEntries(feed.statuses.map((s) => [s.source, s.state]))
    expect(states).toEqual({ news: "ok", youtube: "error", spotify: "error" })
  })

  it("serves from cache on the second call", async () => {
    const fetch = vi.fn(async () => items("news", 1))
    const deps = { fetchers: [fetcher("news", fetch)], disabled: [], cache: memoryStore(), logger }
    await buildNicheFeed(profile, deps)
    const second = await buildNicheFeed(profile, deps)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(second.statuses[0].cache).toBe("hit")
  })
})
