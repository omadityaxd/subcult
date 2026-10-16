import { describe, expect, it } from "vitest"
import { pickArtistId, pickRecentReleases } from "./releases"

const NOW = Date.parse("2026-10-16T12:00:00Z")

const collection = (over: Record<string, unknown>) => ({
  wrapperType: "collection",
  collectionId: 1,
  collectionName: "Chiltern Firehouse - Single",
  artistName: "fakemink & Skepta",
  releaseDate: "2026-10-16T07:00:00Z",
  trackCount: 1,
  artworkUrl100: "https://is1-ssl.mzstatic.com/a/100x100bb.jpg",
  collectionViewUrl: "https://music.apple.com/us/album/1",
  ...over,
})

describe("pickArtistId", () => {
  it("takes only an exact artist name, never a tribute account", () => {
    const json = {
      results: [
        { wrapperType: "artist", artistId: 9, artistName: "cooper2723" },
        { wrapperType: "artist", artistId: 1662047435, artistName: "Nettspend" },
      ],
    }
    expect(pickArtistId(json, "nettspend")).toBe(1662047435)
    expect(pickArtistId(json, "Che")).toBeNull()
  })
})

describe("pickRecentReleases", () => {
  it("keeps recent releases that credit the artist, newest first, typed", () => {
    const json = {
      results: [
        collection({ collectionId: 2, collectionName: "Old", releaseDate: "2026-08-01T07:00:00Z" }),
        collection({}),
        collection({
          collectionId: 3,
          collectionName: "Bye Bye - EP",
          trackCount: 4,
          releaseDate: "2026-10-10T07:00:00Z",
        }),
      ],
    }
    const releases = pickRecentReleases(json, NOW, 14, "fakemink")
    expect(releases.map((r) => [r.title, r.kind])).toEqual([
      ["Chiltern Firehouse", "single"],
      ["Bye Bye", "ep"],
    ])
    expect(releases[0]?.artworkUrl).toContain("600x600bb")
  })

  it("regression: a composer's page lists other people's compilations; those aren't drops", () => {
    const json = {
      results: [
        collection({
          collectionName: "Classical Lullabies with the Sound of Rain",
          artistName: "Jeyem",
          trackCount: 20,
        }),
      ],
    }
    expect(pickRecentReleases(json, NOW, 14, "Frédéric Chopin")).toEqual([])
  })
})
