import { describe, expect, it, vi } from "vitest"
import type { Preview } from "./itunes"
import { buildSoundtrack, formatDuration, spotifySearchUrl } from "./soundtrack"

const song = (title: string, artist: string): Preview => ({
  previewUrl: `https://audio-ssl.itunes.apple.com/${encodeURIComponent(title)}.m4a`,
  appleUrl: null,
  title,
  artist,
  artworkUrl: null,
  durationMs: 180_000,
})

const ARTISTS = [
  { name: "Ken Carson", spotifyId: "3gBZUcNeVumkeeJ19CY2sX" },
  { name: "Che", spotifyId: "5A7T1LAGJg5NXySBoIKUmF" },
]

const CATALOG: Record<string, Preview[]> = {
  "Ken Carson": [
    song("delusional", "Ken Carson"),
    song("Overseas", "Ken Carson"),
    song("Ss", "Ken Carson"),
  ],
  Che: [song("MANNEQUIN", "Che"), song("Overseas", "Che"), song("2sday", "Che")],
}

describe("buildSoundtrack", () => {
  it("interleaves artists round-robin and dedupes by title", async () => {
    const tracks = await buildSoundtrack({
      artists: ARTISTS,
      songsFor: async (artist) => CATALOG[artist.name] ?? [],
    })
    expect(tracks.map((t) => `${t.artist}: ${t.title}`)).toEqual([
      "Ken Carson: delusional",
      "Che: MANNEQUIN",
      "Ken Carson: Overseas",
      "Ken Carson: Ss",
      "Che: 2sday",
    ])
  })

  it("links exact Spotify tracks when known, else a Spotify search", async () => {
    const tracks = await buildSoundtrack({
      artists: ARTISTS.slice(0, 1),
      songsFor: async () => CATALOG["Ken Carson"].slice(0, 2),
      spotifyUrlFor: async (s) =>
        s.title === "delusional" ? "https://open.spotify.com/track/abc" : null,
    })
    expect(tracks.map((t) => t.spotifyUrl)).toEqual([
      "https://open.spotify.com/track/abc",
      spotifySearchUrl("Overseas", "Ken Carson"),
    ])
  })

  it("skips artists whose lookup fails and caps the length", async () => {
    const tracks = await buildSoundtrack({
      artists: ARTISTS,
      songsFor: vi.fn(async (artist) => {
        if (artist.name === "Che") throw new Error("iTunes 403")
        return CATALOG["Ken Carson"]
      }),
      spotifyUrlFor: async () => {
        throw new Error("Spotify rate limited")
      },
      max: 2,
    })
    expect(tracks.map((t) => t.title)).toEqual(["delusional", "Overseas"])
  })
})

describe("formatDuration", () => {
  it("formats m:ss and blanks unknowns", () => {
    expect(formatDuration(187_000)).toBe("3:07")
    expect(formatDuration(null)).toBe("")
  })
})
