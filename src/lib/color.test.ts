import { describe, expect, it } from "vitest"
import {
  INK_DARK,
  INK_LIGHT,
  MIN_TEXT_CONTRAST,
  contrastRatio,
  hexToRgb,
  isHexColor,
  readableTextColor,
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
