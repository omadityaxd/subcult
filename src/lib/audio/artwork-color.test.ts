import { describe, expect, it } from "vitest"
import { pickAccent } from "./artwork-color"

const pixels = (...colors: [number, number, number, number?][]) =>
  new Uint8ClampedArray(colors.flatMap(([r, g, b, a = 255]) => [r, g, b, a]))

describe("pickAccent", () => {
  it("picks the vivid colour over blacks and whites", () => {
    const color = pickAccent(
      pixels([5, 5, 5], [250, 250, 250], [220, 30, 60], [215, 35, 65], [10, 10, 10]),
    )
    expect(color).toBe("#da213f")
  })

  it("returns a mid grey for greyscale art", () => {
    expect(pickAccent(pixels([20, 20, 20], [30, 30, 30]))).toBe("#6e6e6e")
  })

  it("ignores transparent pixels and handles empty input", () => {
    expect(pickAccent(pixels([220, 30, 60, 0]))).toBe("#8a8a8a")
  })
})
