import { describe, expect, it, vi } from "vitest"
import {
  type ItunesResult,
  creditsArtist,
  findArtistPreview,
  findTrackPreview,
  normalizeTitle,
  pickArtistSong,
  pickArtistSongs,
  pickExactMatch,
} from "./itunes"

const result = (overrides: Partial<ItunesResult>): ItunesResult => ({
  trackId: 1,
  artistName: "Che",
  trackName: "MANNEQUIN",
  previewUrl: "https://audio-ssl.itunes.apple.com/p.m4a",
  trackViewUrl: "https://music.apple.com/us/album/x?i=1",
  artworkUrl100: "https://is1-ssl.mzstatic.com/a/100x100bb.jpg",
  ...overrides,
})

describe("normalizeTitle", () => {
  it("ignores features, brackets, version suffixes, case and punctuation", () => {
    expect(normalizeTitle("Hellraiser (feat. OsamaSon)")).toBe("hellraiser")
    expect(normalizeTitle("Change (In the House of Flies) - Remastered")).toBe("change")
    expect(normalizeTitle("40 [Dj Ess Mix]")).toBe("40")
    expect(normalizeTitle("Shine N Peace feat. Someone")).toBe("shine-n-peace")
  })
})

describe("creditsArtist", () => {
  it("finds the artist in multi-artist credits, case-insensitively", () => {
    expect(creditsArtist("evilgiane, xaviersobased & Nettspend", "Nettspend")).toBe(true)
    expect(creditsArtist("Che & OsamaSon", "osamason")).toBe(true)
    expect(creditsArtist("Cherry Glazerr", "Che")).toBe(false)
    // "x" only separates as a standalone word, never inside a name.
    expect(creditsArtist("xaviersobased", "xaviersobased")).toBe(true)
    expect(creditsArtist("Nettspend x xaviersobased", "Nettspend")).toBe(true)
  })
})

describe("pickExactMatch", () => {
  it("needs both the artist credit and the same title", () => {
    const results = [
      result({ trackId: 1, artistName: "Che Guevara Tribute Band", trackName: "MANNEQUIN" }),
      result({ trackId: 2, artistName: "Che", trackName: "Different Song" }),
      result({ trackId: 3, artistName: "Che", trackName: "MANNEQUIN (Explicit)" }),
    ]
    expect(pickExactMatch(results, "Che", "Mannequin")).toMatchObject({
      title: "MANNEQUIN (Explicit)",
      artist: "Che",
      appleUrl: "https://music.apple.com/us/album/x?i=1",
      artworkUrl: "https://is1-ssl.mzstatic.com/a/600x600bb.jpg",
    })
    expect(pickExactMatch(results.slice(0, 2), "Che", "Mannequin")).toBeNull()
  })
})

describe("pickArtistSong", () => {
  it("prefers songs where the artist is the lead credit over features", () => {
    const results = [
      result({ artistName: "Alan Walker & A$AP Rocky", trackName: "Live Fast (PUBGM)" }),
      result({ artistName: "A$AP Rocky", trackName: "L$D" }),
    ]
    expect(pickArtistSong(results, "A$AP Rocky")?.title).toBe("L$D")
    expect(pickArtistSong(results.slice(0, 1), "A$AP Rocky")?.title).toBe("Live Fast (PUBGM)")
  })

  it("takes the first song credited to the artist", () => {
    const results = [
      result({ artistName: "Cherry" }),
      result({ artistName: "Che", trackName: "2sday" }),
    ]
    expect(pickArtistSong(results, "Che")?.title).toBe("2sday")
    expect(pickArtistSong([result({ artistName: "Cherry" })], "Che")).toBeNull()
  })
})

describe("iTunes requests", () => {
  const respond = (results: unknown[]) =>
    vi.fn<(url: string | URL | Request) => Promise<Response>>(
      async () => new Response(JSON.stringify({ resultCount: results.length, results })),
    )

  it("searches songs in the US store and skips results without a preview", async () => {
    const fetchImpl = respond([
      { ...result({ trackId: 9 }), previewUrl: undefined },
      result({ trackId: 10 }),
    ])
    const preview = await findTrackPreview("Che", "MANNEQUIN", { fetchImpl })
    expect(preview?.previewUrl).toBe("https://audio-ssl.itunes.apple.com/p.m4a")
    const url = new URL(String(fetchImpl.mock.calls[0][0]))
    expect(url.searchParams.get("entity")).toBe("song")
    expect(url.searchParams.get("country")).toBe("US")
    expect(url.searchParams.get("term")).toBe("Che mannequin")
  })

  it("searches by artist term for artist previews", async () => {
    const fetchImpl = respond([result({ artistName: "Che", trackName: "2sday" })])
    expect((await findArtistPreview("Che", { fetchImpl }))?.title).toBe("2sday")
    expect(new URL(String(fetchImpl.mock.calls[0][0])).searchParams.get("attribute")).toBe(
      "artistTerm",
    )
  })

  it("throws on HTTP errors and tolerates malformed bodies", async () => {
    const failing = vi.fn(async () => new Response("", { status: 403 }))
    await expect(findArtistPreview("Che", { fetchImpl: failing })).rejects.toThrow("403")
    const junk = vi.fn(async () => new Response(JSON.stringify({ nope: true })))
    expect(await findArtistPreview("Che", { fetchImpl: junk })).toBeNull()
  })
})

describe("pickArtistSongs", () => {
  it("lists lead credits first, then features, without title repeats", () => {
    const results = [
      result({
        trackId: 1,
        artistName: "Alan Walker & A$AP Rocky",
        trackName: "Live Fast (PUBGM)",
      }),
      result({ trackId: 2, artistName: "A$AP Rocky", trackName: "L$D" }),
      result({ trackId: 3, artistName: "A$AP Rocky", trackName: "L$D (Clean)" }),
      result({ trackId: 4, artistName: "A$AP Rocky & Skepta", trackName: "Praise the Lord" }),
      result({ trackId: 5, artistName: "Someone Else", trackName: "Nope" }),
    ]
    expect(pickArtistSongs(results, "A$AP Rocky", 5).map((p) => p.title)).toEqual([
      "L$D",
      "Praise the Lord",
      "Live Fast (PUBGM)",
    ])
    expect(pickArtistSongs(results, "A$AP Rocky", 1)).toHaveLength(1)
  })
})

describe("fuzzy preview matching", () => {
  it("strips producer and ft. credits from titles", () => {
    expect(normalizeTitle("Location ft. Someone")).toBe("location")
    expect(normalizeTitle("Magnolia prod. Pi'erre Bourne")).toBe("magnolia")
    expect(normalizeTitle("Off The Meter {Remix}")).toBe("off-the-meter")
  })

  it("forgives a one-character slip in a longer artist name, never in a short one", () => {
    expect(creditsArtist("Lil Uzi Vertt", "Lil Uzi Vert", true)).toBe(true)
    expect(creditsArtist("The Weeknd", "Weeknd", true)).toBe(true)
    expect(creditsArtist("Chez", "Che", true)).toBe(false)
    expect(creditsArtist("Lil Uzi Vertt", "Lil Uzi Vert")).toBe(false)
  })

  it("prefers the exact title to a near-miss, and strict mode stays exact", () => {
    const near = result({ trackId: 2, artistName: "Che", trackName: "MANNEQUINS" })
    const exact = result({ trackId: 3, artistName: "Che", trackName: "Mannequin" })
    expect(pickExactMatch([near, exact], "Che", "MANNEQUIN")?.title).toBe("Mannequin")
    expect(pickExactMatch([near], "Che", "MANNEQUIN", "strict")).toBeNull()
    expect(pickExactMatch([near], "Che", "MANNEQUIN")?.title).toBe("MANNEQUINS")
  })

  it("retries once with the title alone when artist + title finds nothing", async () => {
    const calls: string[] = []
    const fetchImpl = (async (url: string) => {
      calls.push(url)
      const results = calls.length === 1 ? [] : [result({ artistName: "Che, OsamaSon" })]
      return new Response(JSON.stringify({ results }), { status: 200 })
    }) as unknown as typeof fetch
    const preview = await findTrackPreview("Che", "MANNEQUIN (prod. x)", { fetchImpl })
    expect(preview?.title).toBe("MANNEQUIN")
    expect(calls).toHaveLength(2)
    calls.length = 0
    expect(await findTrackPreview("Che", "MANNEQUIN", { fetchImpl, mode: "strict" })).toBeNull()
    expect(calls).toHaveLength(1)
  })
})
