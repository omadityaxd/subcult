import { describe, expect, it } from "vitest"
import { spotifyUriFrom } from "./spotify-embed"

describe("spotifyUriFrom", () => {
  it("turns open.spotify.com links into URIs the embed can load", () => {
    expect(spotifyUriFrom("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=x")).toBe(
      "spotify:track:4uLU6hMCjMI75M1A2tKUQC",
    )
    expect(spotifyUriFrom("https://open.spotify.com/intl-de/playlist/37i9dQZF1DXcBWIGoYBM5M")).toBe(
      "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M",
    )
  })

  it("returns null for search links, so the UI never offers a broken embed", () => {
    expect(spotifyUriFrom("https://open.spotify.com/search/ken%20carson")).toBeNull()
    expect(spotifyUriFrom(null)).toBeNull()
  })
})
