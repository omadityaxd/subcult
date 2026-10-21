import { describe, expect, it } from "vitest"
import type { SearchResults } from "@/app/api/search/route"
import type { NichePreset } from "@/lib/niches/catalog"
import { buildEntries } from "./entries"

const preset = (slug: string, name: string): NichePreset =>
  ({
    slug,
    name,
    tagline: `${name} tagline`,
    palette: ["#000"],
    emoji: "",
    imageUrl: null,
    aliases: [],
  }) as unknown as NichePreset

const PRESETS = [preset("rage", "rage"), preset("vamp", "vamp")]

const results: SearchResults = {
  artists: [{ slug: "ken-carson", name: "Ken Carson", imageUrl: null, niche: "rage" }],
  brands: [{ slug: "rick-owens", name: "Rick Owens", listings: 12 }],
  tracks: [
    {
      id: "search:x",
      previewUrl: "x",
      appleUrl: null,
      title: "ss",
      artist: "Ken Carson",
      artworkUrl: null,
      durationMs: null,
    },
  ],
  fits: [{ id: "f1", handle: "om", imageUrl: "i", caption: null }],
  headlines: [{ title: "Ken Carson drops", url: "u", outlet: "Complex", imageUrl: null }],
}

describe("buildEntries", () => {
  it("shows recent and trending searches when the query is empty", () => {
    const entries = buildEntries({
      query: "",
      presets: PRESETS,
      results: null,
      recent: ["rick owens"],
      trending: [{ kind: "artist", slug: "ken-carson", label: "Ken Carson" }],
    })
    expect(entries.map((e) => e.group)).toEqual(["Recent", "Trending", "Pages", "Pages"])
  })

  it("groups everything a query finds, niches first", () => {
    const entries = buildEntries({
      query: "ra",
      presets: PRESETS,
      results,
      recent: [],
      trending: [],
    })
    expect([...new Set(entries.map((e) => e.group))]).toEqual([
      "Niches",
      "Artists",
      "Brands",
      "Tracks",
      "Fits",
      "Headlines",
    ])
    expect(entries.find((e) => e.kind === "brand")?.hint).toBe("12 live listings")
    expect(entries.find((e) => e.kind === "fit")?.label).toBe("Fit by @om")
  })

  it("says nothing about listings when they aren't switched on", () => {
    const off = { ...results, brands: [{ slug: "rick-owens", name: "Rick Owens", listings: null }] }
    const entries = buildEntries({
      query: "rick",
      presets: PRESETS,
      results: off,
      recent: [],
      trending: [],
    })
    expect(entries.find((e) => e.kind === "brand")?.hint).toBe("Brand")
  })

  it("offers to summon a niche only when no niche has that exact name", () => {
    const has = (q: string) =>
      buildEntries({ query: q, presets: PRESETS, results: null, recent: [], trending: [] }).some(
        (e) => e.kind === "summon",
      )
    expect(has("rage")).toBe(false)
    expect(has("cybergoth")).toBe(true)
    const named = buildEntries({
      query: "ken carson",
      presets: PRESETS,
      results,
      recent: [],
      trending: [],
    })
    expect(named.some((e) => e.kind === "summon")).toBe(false)
  })
})
