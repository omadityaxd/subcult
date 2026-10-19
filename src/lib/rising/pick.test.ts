import { describe, expect, it } from "vitest"
import type { Momentum } from "./momentum"
import { RISING_MIN, pickRising } from "./pick"

const m = (slug: string, niches: string[]): Momentum => ({
  entity: `artist:${slug}`,
  label: slug,
  niches,
  last7: 4,
  prior28: 1,
  ratio: 3,
  score: 2,
})

describe("pickRising", () => {
  it("keeps to the reader's niches when they have enough", () => {
    const pool = ["a", "b", "c", "d", "e", "f"].map((s) => m(s, ["rage"]))
    const picked = pickRising(pool, { niches: ["rage"], mine: new Set(), adjacent: [] }, 6)
    expect(picked).toHaveLength(6)
    expect(picked.every((p) => p.scope === "yours")).toBe(true)
  })

  it("widens to adjacent niches, then everything, to reach the minimum, and says so", () => {
    const pool = [
      m("a", ["rage"]),
      m("b", ["jerk"]),
      m("c", ["jerk"]),
      m("d", ["opium"]),
      m("e", ["x"]),
    ]
    const picked = pickRising(pool, { niches: ["rage"], mine: new Set(), adjacent: ["jerk"] }, 6)
    expect(picked.map((p) => [p.momentum.label, p.scope])).toEqual([
      ["a", "yours"],
      ["b", "nearby"],
      ["c", "nearby"],
      ["d", "everywhere"],
      ["e", "everywhere"],
    ])
    expect(picked).toHaveLength(RISING_MIN)
  })

  it("counts the reader's own entities even outside their niches, once", () => {
    const pool = [m("a", ["elsewhere"]), m("a", ["rage"])]
    const picked = pickRising(
      pool,
      { niches: ["rage"], mine: new Set(["artist:a"]), adjacent: [] },
      6,
    )
    expect(picked).toHaveLength(1)
  })

  it("never pads with made-up entries when little is rising", () => {
    expect(pickRising([], { niches: ["rage"], mine: new Set(), adjacent: [] }, 6)).toEqual([])
  })

  it("on a niche page, keeps to its verified entities and labels adjacent ones nearby", () => {
    const pool = [m("gucci", ["trap"]), m("ken", ["rage"]), m("thug", ["trap", "rage"])]
    const picked = pickRising(
      pool,
      {
        niches: ["rage"],
        mine: new Set(),
        adjacent: ["trap"],
        verified: new Set(["artist:ken"]),
      },
      6,
    )
    expect(picked.map((p) => [p.momentum.label, p.scope])).toEqual([
      ["ken", "yours"],
      ["gucci", "nearby"],
      ["thug", "nearby"],
    ])
  })
})
