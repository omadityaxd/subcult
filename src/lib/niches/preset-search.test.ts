import { describe, expect, it } from "vitest"
import { presetIs, presetMatches } from "./preset-search"

const vamp = { name: "vamp", aliases: ["opium fashion", "vamp / opium-inspired"] }

describe("presetMatches", () => {
  it("matches names and aliases case-insensitively", () => {
    expect(presetMatches(vamp, "VAMP")).toBe(true)
    expect(presetMatches(vamp, "Opium")).toBe(true)
  })

  it("ignores punctuation and spacing differences", () => {
    expect(presetMatches(vamp, "opium-inspired")).toBe(true)
    expect(presetMatches(vamp, "opium   fashion")).toBe(true)
  })

  it("matches everything on an empty query and nothing on a miss", () => {
    expect(presetMatches(vamp, "  ")).toBe(true)
    expect(presetMatches(vamp, "cottagecore")).toBe(false)
  })
})

describe("presetIs", () => {
  it("is exact on name or alias, ignoring case and punctuation", () => {
    expect(presetIs(vamp, "Opium-Fashion")).toBe(true)
    expect(presetIs(vamp, "vamp")).toBe(true)
    expect(presetIs(vamp, "opium")).toBe(false)
    expect(presetIs(vamp, "")).toBe(false)
  })
})
