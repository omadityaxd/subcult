import { describe, expect, it } from "vitest"
import { artworkUrlSchema, buildSlides, slideNiche, slideSchema } from "./slides"
import type { WrappedSummary } from "./stats"

const SUMMARY: WrappedSummary = {
  since: Date.UTC(2026, 9, 1),
  minutesListened: 42,
  topNiches: [
    { slug: "rage", percent: 60 },
    { slug: "vamp", percent: 40 },
  ],
  topArtists: [{ name: "Ken Carson", minutes: 20 }],
  topTracks: [
    {
      id: "t1",
      title: "delusional",
      artist: "Ken Carson",
      artworkUrl: "https://is1-ssl.mzstatic.com/a/600x600bb.jpg",
    },
  ],
  nichesDiscovered: 3,
  discovered: ["rage", "vamp", "jerk"],
  era: { slug: "rage", share: 60 },
  week: [{ slug: "rage", percent: 100 }],
  hasData: true,
}

describe("artworkUrlSchema", () => {
  it("only accepts https Spotify/Apple artwork hosts", () => {
    expect(artworkUrlSchema.safeParse("https://i.scdn.co/image/abc").success).toBe(true)
    expect(artworkUrlSchema.safeParse("https://is3-ssl.mzstatic.com/x.jpg").success).toBe(true)
    expect(artworkUrlSchema.safeParse("http://i.scdn.co/image/abc").success).toBe(false)
    expect(artworkUrlSchema.safeParse("https://evil.example.com/i.scdn.co.jpg").success).toBe(false)
    expect(artworkUrlSchema.safeParse("https://169.254.169.254/latest").success).toBe(false)
  })
})

describe("buildSlides", () => {
  it("builds a valid deck from a summary, dropping unsafe images", () => {
    const slides = buildSlides(SUMMARY, () => "https://attacker.example/x.png")
    expect(slides.map((s) => s.kind)).toEqual([
      "intro",
      "minutes",
      "niches",
      "artists",
      "tracks",
      "discovered",
      "era",
    ])
    for (const slide of slides) expect(slideSchema.safeParse(slide).success).toBe(true)
    const artists = slides.find((s) => s.kind === "artists")
    expect(artists?.kind === "artists" && artists.artists[0].imageUrl).toBeNull()
  })

  it("skips slides with nothing to say", () => {
    const slides = buildSlides(
      { ...SUMMARY, minutesListened: 0, topArtists: [], topTracks: [], era: null },
      () => null,
    )
    expect(slides.map((s) => s.kind)).toEqual(["intro", "niches", "discovered"])
  })

  it("picks the niche that colours each slide", () => {
    const slides = buildSlides(SUMMARY, () => null)
    expect(slideNiche(slides[0], "rage")).toBe("rage")
    expect(slideNiche(slides.find((s) => s.kind === "era") as never, null)).toBe("rage")
  })
})
