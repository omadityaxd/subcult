import { describe, expect, it } from "vitest"
import { coverBackground, hashSeed } from "./cover"

const palette = ["#1f2a24", "#3a5a40", "#a3b18a", "#dad7cd", "#f2efe6"]

describe("coverBackground", () => {
  it("is deterministic per seed", () => {
    expect(coverBackground(palette, "gorpcore")).toEqual(coverBackground(palette, "gorpcore"))
  })

  it("varies between seeds", () => {
    expect(coverBackground(palette, "gorpcore").backgroundImage).not.toBe(
      coverBackground(palette, "skater").backgroundImage,
    )
  })

  it("uses the darkest color as base and every other color as a blob", () => {
    const cover = coverBackground(palette, "gorpcore")
    expect(cover.backgroundColor).toBe("#1f2a24")
    expect(cover.backgroundImage.match(/radial-gradient/g)).toHaveLength(5)
  })
})

describe("hashSeed", () => {
  it("returns a stable unsigned 32-bit int", () => {
    expect(hashSeed("subcult")).toBe(hashSeed("subcult"))
    expect(hashSeed("subcult")).toBeGreaterThanOrEqual(0)
    expect(hashSeed("subcult")).toBeLessThan(2 ** 32)
  })
})
