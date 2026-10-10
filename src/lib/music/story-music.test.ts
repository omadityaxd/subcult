import { describe, expect, it, vi } from "vitest"
import type { FeedItem } from "@/lib/feed/types"
import type { Preview } from "./itunes"
import { resolveStoryMusic } from "./story-music"

const track = (title: string, subtitle: string, id = title): FeedItem => ({
  id: `spotify:track:${id}`,
  source: "spotify",
  type: "track",
  title,
  subtitle,
  imageUrl: null,
  url: `https://open.spotify.com/track/${id}`,
  publishedAt: null,
  score: 1,
  meta: {},
})

const preview = (title: string, artist: string): Preview => ({
  previewUrl: `https://audio-ssl.itunes.apple.com/${title}.m4a`,
  appleUrl: `https://music.apple.com/${title}`,
  title,
  artist,
  artworkUrl: null,
})

const ARTISTS = [
  { name: "Che", spotifyId: "5A7T1LAGJg5NXySBoIKUmF" },
  { name: "OsamaSon", spotifyId: "0uj6QiPsPfK8ywLC7uwBE1" },
]

describe("resolveStoryMusic", () => {
  it("prefers an exact match for a verified artist's Spotify track", async () => {
    const lookupTrack = vi.fn(async (_artist: string, title: string) =>
      title === "Hellraiser" ? preview("Hellraiser", "Che & OsamaSon") : null,
    )
    const lookupArtist = vi.fn(async () => preview("x", "Che"))
    const music = await resolveStoryMusic({
      artists: ARTISTS,
      spotifyItems: [
        track("Some Song", "Unrelated Artist"),
        track("MANNEQUIN", "Che"),
        track("Hellraiser", "Che, OsamaSon"),
      ],
      lookupTrack,
      lookupArtist,
    })
    expect(lookupTrack.mock.calls.map((call) => call[1])).toEqual(["MANNEQUIN", "Hellraiser"])
    expect(lookupArtist).not.toHaveBeenCalled()
    expect(music).toMatchObject({
      title: "Hellraiser",
      artist: "Che, OsamaSon",
      spotifyUrl: "https://open.spotify.com/track/Hellraiser",
      appleUrl: "https://music.apple.com/Hellraiser",
    })
  })

  it("falls back to a verified artist's song, linking their Spotify artist page", async () => {
    const music = await resolveStoryMusic({
      artists: ARTISTS,
      spotifyItems: [],
      lookupTrack: vi.fn(async () => null),
      lookupArtist: vi.fn(async (artist) =>
        artist.name === "OsamaSon" ? preview("Ik what you did last summer", "OsamaSon") : null,
      ),
    })
    expect(music).toMatchObject({
      title: "Ik what you did last summer",
      spotifyUrl: "https://open.spotify.com/artist/0uj6QiPsPfK8ywLC7uwBE1",
    })
  })

  it("stays silent (null) when nothing matches, and caps lookups", async () => {
    const lookupTrack = vi.fn(async () => null)
    const lookupArtist = vi.fn(async () => null)
    const music = await resolveStoryMusic({
      artists: ARTISTS,
      spotifyItems: [track("a", "Che"), track("b", "Che"), track("c", "Che"), track("d", "Che")],
      lookupTrack,
      lookupArtist,
      maxLookups: 3,
    })
    expect(music).toBeNull()
    expect(lookupTrack.mock.calls.length + lookupArtist.mock.calls.length).toBe(3)
  })

  it("treats lookup errors as misses, not failures", async () => {
    const music = await resolveStoryMusic({
      artists: ARTISTS,
      spotifyItems: [track("MANNEQUIN", "Che")],
      lookupTrack: vi.fn(async () => {
        throw new Error("iTunes 403")
      }),
      lookupArtist: vi.fn(async () => preview("2sday", "Che")),
    })
    expect(music?.title).toBe("2sday")
  })
})
