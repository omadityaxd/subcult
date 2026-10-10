import { describe, expect, it } from "vitest"
import { makeDraft } from "@/lib/engine/test-fixtures"
import { mapSearchResponse, searchResponseSchema, spotifyFetcher } from "./spotify"

const response = {
  tracks: {
    items: [
      {
        id: "t1",
        name: "Holocene",
        external_urls: { spotify: "https://open.spotify.com/track/t1" },
        artists: [{ name: "Bon Iver" }],
        album: {
          name: "Bon Iver",
          images: [{ url: "https://i.scdn.co/image/a" }],
          release_date: "2011",
        },
      },
    ],
  },
  playlists: {
    items: [
      null,
      {
        id: "p1",
        name: "cabin folk",
        description: null,
        external_urls: { spotify: "https://open.spotify.com/playlist/p1" },
        images: null,
        owner: { display_name: "someone" },
      },
    ],
  },
}

describe("mapSearchResponse", () => {
  it("normalizes tracks and playlists, skipping null entries", () => {
    const items = mapSearchResponse(searchResponseSchema.parse(response))
    expect(items.map((i) => i.id)).toEqual(["spotify:track:t1", "spotify:playlist:p1"])
    expect(items[0]).toMatchObject({
      type: "track",
      subtitle: "Bon Iver",
      imageUrl: "https://i.scdn.co/image/a",
      publishedAt: "2011-01-01T00:00:00.000Z",
      meta: { embedUrl: "https://open.spotify.com/embed/track/t1" },
    })
    expect(items[1]).toMatchObject({ type: "playlist", subtitle: "by someone", imageUrl: null })
  })
})

describe("spotifyFetcher", () => {
  it("gets a token once, searches with limit ≤10 and dedupes", async () => {
    const calls: string[] = []
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      calls.push(url)
      if (url.includes("accounts.spotify.com")) {
        return Response.json({ access_token: "tok", expires_in: 3600 })
      }
      return Response.json(response)
    }
    const fetcher = spotifyFetcher({ clientId: "id", clientSecret: "secret", fetchImpl })
    const items = await fetcher.fetch({ ...makeDraft(), slug: "gorpcore", schemaVersion: 1 })

    expect(calls.filter((url) => url.includes("/api/token"))).toHaveLength(1)
    const limits = calls
      .filter((url) => url.includes("/v1/search"))
      .map((url) => Number(new URL(url).searchParams.get("limit")))
    expect(Math.max(...limits)).toBeLessThanOrEqual(10)
    expect(items.map((i) => i.id)).toEqual(["spotify:track:t1", "spotify:playlist:p1"])
  })

  it("throws when every request fails, so the cache can serve stale data", async () => {
    const fetchImpl: typeof fetch = async () => new Response("nope", { status: 403 })
    const fetcher = spotifyFetcher({ clientId: "id", clientSecret: "secret", fetchImpl })
    await expect(
      fetcher.fetch({ ...makeDraft(), slug: "gorpcore", schemaVersion: 1 }),
    ).rejects.toThrow(/Spotify token 403/)
  })
})
