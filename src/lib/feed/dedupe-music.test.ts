import { describe, expect, it } from "vitest"
import { dedupeMusic, musicKeys } from "./dedupe-music"
import type { FeedItem } from "./types"

const item = (over: Partial<FeedItem>): FeedItem => ({
  id: "x",
  source: "spotify",
  type: "track",
  title: "Magnolia",
  subtitle: "Playboi Carti",
  imageUrl: null,
  url: "https://open.spotify.com/search/magnolia",
  publishedAt: null,
  score: 1,
  meta: {},
  ...over,
})

describe("dedupeMusic", () => {
  it("keeps one Magnolia whether it comes from Spotify, a soundtrack preview or another niche", () => {
    const items = [
      item({ id: "spotify:track:1e1JKLEDKP7hEQzJfNAgPl" }),
      item({ id: "soundtrack:999", url: "https://open.spotify.com/track/1e1JKLEDKP7hEQzJfNAgPl" }),
      item({ id: "soundtrack:777", title: "Magnolia (Explicit)", subtitle: "Playboi Carti" }),
      item({
        id: "spotify:track:abcdefghij",
        title: "Long Time - Intro",
        subtitle: "Playboi Carti",
      }),
    ]
    expect(dedupeMusic(items).map((i) => i.id)).toEqual([
      "spotify:track:1e1JKLEDKP7hEQzJfNAgPl",
      "spotify:track:abcdefghij",
    ])
  })

  it("keeps different songs with the same title by different artists", () => {
    const items = [item({ id: "a" }), item({ id: "b", subtitle: "Someone Else" })]
    expect(dedupeMusic(items)).toHaveLength(2)
  })

  it("dedupes across pages with a shared set and leaves non-music alone", () => {
    const seen = new Set<string>()
    dedupeMusic([item({ id: "spotify:track:1e1JKLEDKP7hEQzJfNAgPl" })], seen)
    const pin = item({ id: "pin:1", source: "arena", type: "pin", title: "Magnolia" })
    expect(dedupeMusic([item({ id: "soundtrack:2" }), pin], seen).map((i) => i.id)).toEqual([
      "pin:1",
    ])
    expect(musicKeys(pin)).toEqual([])
  })
})
