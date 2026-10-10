import { describe, expect, it } from "vitest"
import { type Blurbs, decodeMix, encodeMix, scoreVibe, templateBlurb, topMix } from "./score"

const CARDS: { id: string; weights: Record<string, number> }[] = [
  { id: "pit", weights: { rage: 3, vamp: 1 } },
  { id: "leather", weights: { vamp: 3, goth: 2 } },
  { id: "white-pony", weights: { "deftones-core": 3, goth: 1 } },
]

describe("scoreVibe", () => {
  it("adds liked weights, lightly subtracts passed ones and ignores skips", () => {
    const scores = scoreVibe(CARDS, { pit: "like", leather: "like", "white-pony": "pass" })
    expect(scores).toEqual([
      { slug: "vamp", score: 4 },
      { slug: "rage", score: 3 },
      { slug: "goth", score: 2 - 0.3 },
    ])
    expect(scoreVibe(CARDS, { pit: "skip" })).toEqual([])
  })

  it("drops niches that end up at or below zero", () => {
    expect(scoreVibe(CARDS, { "white-pony": "pass" })).toEqual([])
  })
})

describe("topMix", () => {
  it("keeps the top three and rounds to exactly 100", () => {
    const mix = topMix([
      { slug: "a", score: 1 },
      { slug: "b", score: 1 },
      { slug: "c", score: 1 },
      { slug: "d", score: 0.5 },
    ])
    expect(mix.map((m) => m.slug).sort()).toEqual(["a", "b", "c"])
    expect(mix.reduce((sum, m) => sum + m.percent, 0)).toBe(100)
  })

  it("orders by percent and handles a single niche", () => {
    expect(topMix([{ slug: "rage", score: 5 }])).toEqual([{ slug: "rage", percent: 100 }])
    const mix = topMix([
      { slug: "vamp", score: 4 },
      { slug: "rage", score: 3 },
      { slug: "goth", score: 1.7 },
    ])
    expect(mix.map((m) => m.slug)).toEqual(["vamp", "rage", "goth"])
    expect(mix.map((m) => m.percent)).toEqual([46, 34, 20])
  })

  it("is empty when nothing scored", () => {
    expect(topMix([])).toEqual([])
  })
})

describe("share encoding", () => {
  const isNiche = (slug: string) => ["rage", "vamp", "dark-plugg"].includes(slug)

  it("round-trips a mix", () => {
    const mix = [
      { slug: "rage", percent: 47 },
      { slug: "dark-plugg", percent: 31 },
      { slug: "vamp", percent: 22 },
    ]
    const encoded = encodeMix(mix)
    expect(encoded).toBe("rage.47_dark-plugg.31_vamp.22")
    expect(decodeMix(encoded, isNiche)).toEqual(mix)
  })

  it("rejects unknown niches, bad totals, duplicates and junk", () => {
    expect(decodeMix("rage.50_ghost.50", isNiche)).toBeNull()
    expect(decodeMix("rage.50_vamp.40", isNiche)).toBeNull()
    expect(decodeMix("rage.50_rage.50", isNiche)).toBeNull()
    expect(decodeMix("<script>", isNiche)).toBeNull()
    expect(decodeMix("rage.25_vamp.25_dark-plugg.25_rage.25", isNiche)).toBeNull()
  })
})

describe("templateBlurb", () => {
  const blurbs: Blurbs = {
    niches: { rage: "Rage line.", vamp: "Vamp line.", plugg: "Plugg line." },
    combos: [{ pair: ["vamp", "rage"], text: "Hand-written combo." }],
    branchCombos: {
      "music+fashion": "You hear {a} and wear {b}.",
      "metal+any": "Heavy {a}, plus {b}.",
    },
    fallback: "{a} then {b}.",
  }
  const helpers = {
    nameOf: (slug: string) => slug,
    branchOf: (slug: string) =>
      ({ rage: "music", plugg: "music", vamp: "fashion", deftones: "metal" })[slug],
  }

  it("prefers a hand-written pairing in either order", () => {
    expect(
      templateBlurb(
        [
          { slug: "rage", percent: 60 },
          { slug: "vamp", percent: 40 },
        ],
        blurbs,
        helpers,
      ),
    ).toBe("Rage line. Hand-written combo.")
  })

  it("falls back to branch templates, then the generic line", () => {
    const branch = templateBlurb(
      [
        { slug: "plugg", percent: 60 },
        { slug: "vamp", percent: 40 },
      ],
      blurbs,
      helpers,
    )
    expect(branch).toBe("Plugg line. You hear plugg and wear vamp.")
    const any = templateBlurb(
      [
        { slug: "deftones", percent: 60 },
        { slug: "plugg", percent: 40 },
      ],
      blurbs,
      helpers,
    )
    expect(any).toBe("deftones runs your whole personality. Heavy deftones, plus plugg.")
    expect(
      templateBlurb(
        [
          { slug: "rage", percent: 60 },
          { slug: "plugg", percent: 40 },
        ],
        blurbs,
        helpers,
      ),
    ).toBe("Rage line. rage then plugg.")
  })

  it("uses just the lead line for a single niche, and nothing for none", () => {
    expect(templateBlurb([{ slug: "rage", percent: 100 }], blurbs, helpers)).toBe("Rage line.")
    expect(templateBlurb([], blurbs, helpers)).toBe("")
  })
})
