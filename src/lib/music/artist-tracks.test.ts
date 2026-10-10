import { describe, expect, it, vi } from "vitest"
import { type SpotifySearchResponse, searchResponseSchema } from "@/lib/sources/spotify"
import { findArtistTracks, tracksCrediting } from "./artist-tracks"

const track = (id: string, artists: { id: string; name: string }[]) => ({
  id,
  name: `Song ${id}`,
  external_urls: { spotify: `https://open.spotify.com/track/${id}` },
  artists,
  album: { name: `Album ${id}`, images: [{ url: `https://i.scdn.co/image/${id}` }] },
})

const RESPONSE: SpotifySearchResponse = searchResponseSchema.parse({
  tracks: {
    items: [
      track("a", [{ id: "CHE", name: "Che" }]),
      // Same name, different artist: must be dropped.
      track("b", [{ id: "OTHER", name: "Che" }]),
      track("c", [
        { id: "OSAMA", name: "OsamaSon" },
        { id: "CHE", name: "Che" },
      ]),
      null,
    ],
  },
})

describe("tracksCrediting", () => {
  it("keeps only tracks credited to the verified artist ID, features included", () => {
    const tracks = tracksCrediting(RESPONSE, "CHE")
    expect(tracks.map((t) => t.id)).toEqual(["a", "c"])
    expect(tracks[1]).toMatchObject({
      title: "Song c",
      artists: "OsamaSon, Che",
      album: "Album c",
      imageUrl: "https://i.scdn.co/image/c",
      url: "https://open.spotify.com/track/c",
    })
  })
})

describe("findArtistTracks", () => {
  it("searches by plain name (not the fuzzy artist: filter) and caps the result", async () => {
    const search = vi.fn(async () => RESPONSE)
    const tracks = await findArtistTracks({ search }, { name: "Che", spotifyId: "CHE" }, 1)
    expect(search).toHaveBeenCalledWith("Che", "track", 10)
    expect(tracks.map((t) => t.id)).toEqual(["a"])
  })
})
