import { describe, expect, it } from "vitest"
import {
  MIN_TEXT_CONTRAST,
  MIN_UI_CONTRAST,
  contrastRatio,
  pickAccent,
  readableTextColor,
} from "@/lib/color"
import { SEED_PROFILES } from "./catalog"
import { PAGE_BACKGROUND, nicheTheme, tintTheme } from "./theme"

describe("pickAccent", () => {
  it("prefers the most saturated color that still reads on the background", () => {
    const palette = ["#111111", "#ff2e88", "#888888", "#eeeeee"]
    expect(pickAccent(palette, "#0b0a10")).toBe("#ff2e88")
  })

  it("doesn't mistake a pale tint for a vivid accent", () => {
    // gorpcore: the sage green should win over the near-white cream.
    expect(pickAccent(["#1f2a24", "#3a5a40", "#a3b18a", "#dad7cd", "#f2efe6"], "#0b0a10")).toBe(
      "#a3b18a",
    )
  })

  it("falls back to the highest-contrast color when none pass", () => {
    expect(pickAccent(["#101010", "#202020"], "#0b0a10")).toBe("#202020")
  })
})

describe("seed palettes", () => {
  it.each(SEED_PROFILES.map((p) => [p.slug, p.palette] as const))(
    "%s gets accessible accents in both themes",
    (_slug, palette) => {
      const { accentDark, accentLight } = nicheTheme(palette)
      expect(contrastRatio(accentDark, PAGE_BACKGROUND.dark)).toBeGreaterThanOrEqual(
        MIN_UI_CONTRAST,
      )
      expect(contrastRatio(accentLight, PAGE_BACKGROUND.light)).toBeGreaterThanOrEqual(
        MIN_UI_CONTRAST,
      )
      for (const accent of [accentDark, accentLight]) {
        expect(contrastRatio(accent, readableTextColor(accent))).toBeGreaterThanOrEqual(
          MIN_TEXT_CONTRAST,
        )
      }
    },
  )
})

describe("tintTheme", () => {
  it("re-centres the accent on any color, readable in both themes", () => {
    const style = tintTheme("#1a0c10") as Record<string, string>
    expect(
      contrastRatio(style["--niche-accent-dark"], PAGE_BACKGROUND.dark),
    ).toBeGreaterThanOrEqual(3)
    expect(
      contrastRatio(style["--niche-accent-light"], PAGE_BACKGROUND.light),
    ).toBeGreaterThanOrEqual(3)
    expect(style["--niche-gradient"]).toContain("#1a0c10")
  })
})
