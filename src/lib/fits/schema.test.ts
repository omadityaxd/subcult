import { describe, expect, it } from "vitest"
import { fitInputSchema, handleSchema } from "./schema"

describe("handleSchema", () => {
  it("accepts simple handles and normalizes case", () => {
    expect(handleSchema.parse("Vamp.Archive")).toBe("vamp.archive")
    expect(handleSchema.safeParse("ok_handle").success).toBe(true)
    expect(handleSchema.parse("RickFan")).toBe("rickfan")
  })

  it("rejects junk, edge punctuation and lookalike tricks", () => {
    for (const bad of ["ab", "has space", "a..b", ".lead", "trail_", "emoji😀", "x".repeat(25)]) {
      expect(handleSchema.safeParse(bad).success, bad).toBe(false)
    }
  })
})

describe("fitInputSchema", () => {
  const base = { caption: "fit check", niches: ["vamp"], brands: ["rick-owens"], pieces: [] }

  it("accepts known niches and brands", () => {
    expect(fitInputSchema.safeParse(base).success).toBe(true)
  })

  it("rejects unknown tags, too many tags and songs from outside the catalog", () => {
    expect(fitInputSchema.safeParse({ ...base, niches: ["not-a-niche"] }).success).toBe(false)
    expect(fitInputSchema.safeParse({ ...base, brands: ["supreme-fake"] }).success).toBe(false)
    expect(
      fitInputSchema.safeParse({ ...base, niches: ["vamp", "rage", "jerk", "plugg"] }).success,
    ).toBe(false)
    expect(
      fitInputSchema.safeParse({
        ...base,
        song: {
          title: "x",
          artist: "y",
          previewUrl: "https://evil.example/a.mp3",
          artworkUrl: null,
          spotifyUrl: null,
        },
      }).success,
    ).toBe(false)
    expect(
      fitInputSchema.safeParse({
        ...base,
        song: {
          title: "x",
          artist: "y",
          previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/a.m4a",
          artworkUrl: null,
          spotifyUrl: null,
        },
      }).success,
    ).toBe(true)
  })
})
