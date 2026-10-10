import { describe, expect, it } from "vitest"
import { NICHE_PRESETS } from "@/lib/niches/catalog"
import { normalizeNicheName, parseNicheInput, toNicheSlug } from "./slug"

describe("toNicheSlug", () => {
  it.each([
    ["Jersey Club Girlies!!", "jersey-club-girlies"],
    ["  jersey-club   girlies ", "jersey-club-girlies"],
    ["Café Racer", "cafe-racer"],
    ["R&B", "r-and-b"],
    ["Y2K Cyber", "y2k-cyber"],
    ["ＧＯＲＰＣＯＲＥ", "gorpcore"],
  ])("%s -> %s", (input, expected) => {
    expect(toNicheSlug(input)).toBe(expected)
  })

  it("caps length without leaving a trailing dash", () => {
    const slug = toNicheSlug(`${"a".repeat(63)} b`)
    expect(slug.length).toBeLessThanOrEqual(64)
    expect(slug.endsWith("-")).toBe(false)
  })

  it("matches every preset's hard-coded slug", () => {
    for (const preset of NICHE_PRESETS) {
      expect(toNicheSlug(preset.name)).toBe(preset.slug)
    }
  })
})

describe("normalizeNicheName", () => {
  it("collapses whitespace and lowercases", () => {
    expect(normalizeNicheName("  Dark\n  Academia ")).toBe("dark academia")
  })
})

describe("parseNicheInput", () => {
  it("accepts a normal niche", () => {
    expect(parseNicheInput("Midwest Emo")).toEqual({
      ok: true,
      name: "midwest emo",
      slug: "midwest-emo",
    })
  })

  it.each([undefined, 42, "", "a", "!!!", "1234", "x".repeat(51)])("rejects %s", (input) => {
    expect(parseNicheInput(input).ok).toBe(false)
  })
})
