import { describe, expect, it } from "vitest"
import {
  INK_DARK,
  INK_LIGHT,
  MIN_TEXT_CONTRAST,
  NEAR_COLOR,
  colorDistance,
  contrastRatio,
  ensureContrast,
  hexToRgb,
  isHexColor,
  luminance,
  mixHex,
  readableTextColor,
  rgbToHex,
  withAlpha,
} from "./color"

describe("hexToRgb", () => {
  it("parses 6-digit hex with or without #", () => {
    expect(hexToRgb("#ff8000")).toEqual({ r: 255, g: 128, b: 0 })
    expect(hexToRgb("ff8000")).toEqual({ r: 255, g: 128, b: 0 })
  })

  it("expands 3-digit shorthand", () => {
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 })
  })

  it("throws on invalid input", () => {
    expect(() => hexToRgb("not-a-color")).toThrow(/Invalid hex/)
  })
})

describe("isHexColor", () => {
  it("accepts hex and rejects everything else", () => {
    expect(isHexColor("#A1B2C3")).toBe(true)
    expect(isHexColor("rgb(0,0,0)")).toBe(false)
  })
})

describe("contrastRatio", () => {
  it("is 21 for black on white and 1 for identical colors", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1)
    expect(contrastRatio("#123456", "#123456")).toBeCloseTo(1, 5)
  })
})

describe("readableTextColor", () => {
  it("uses dark ink on light backgrounds and white on dark ones", () => {
    expect(readableTextColor("#f5f0e1")).toBe(INK_DARK)
    expect(readableTextColor("#1a1a2e")).toBe(INK_LIGHT)
  })

  it.each(["#c6ff3d", "#8b5cf6", "#ff2e88", "#3a5a40", "#e9c46a", "#264653"])(
    "meets WCAG AA on generated palette color %s",
    (background) => {
      expect(contrastRatio(background, readableTextColor(background))).toBeGreaterThanOrEqual(
        MIN_TEXT_CONTRAST,
      )
    },
  )
})

describe("withAlpha", () => {
  it("formats and clamps alpha", () => {
    expect(withAlpha("#ffffff", 0.5)).toBe("rgb(255 255 255 / 0.5)")
    expect(withAlpha("#000000", 2)).toBe("rgb(0 0 0 / 1)")
  })
})

describe("ensureContrast", () => {
  it("keeps readable colors and lifts unreadable ones on dark backgrounds", () => {
    expect(ensureContrast("#ff4d6d", "#0b0a10")).toBe("#ff4d6d")
    const lifted = ensureContrast("#1a0c10", "#0b0a10")
    expect(contrastRatio(lifted, "#0b0a10")).toBeGreaterThanOrEqual(3)
  })

  it("darkens on light backgrounds", () => {
    const darkened = ensureContrast("#ead9dc", "#f2f2f7")
    expect(contrastRatio(darkened, "#f2f2f7")).toBeGreaterThanOrEqual(3)
    expect(luminance(darkened)).toBeLessThan(luminance("#ead9dc"))
  })
})

describe("colorDistance", () => {
  it("puts shades of one family closer than different hues", () => {
    expect(colorDistance("#a31f34", "#a31f34")).toBe(0)
    expect(colorDistance("#a31f34", "#8a1a2c")).toBeLessThan(NEAR_COLOR)
    expect(colorDistance("#a31f34", "#1f6fa3")).toBeGreaterThan(NEAR_COLOR)
  })

  it("round-trips hex through rgb and mixes linearly", () => {
    expect(rgbToHex(hexToRgb("#0b0a10"))).toBe("#0b0a10")
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080")
  })
})
