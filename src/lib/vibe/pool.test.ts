import { describe, expect, it } from "vitest"
import { seededRandom } from "./adaptive"
import { type LiveCandidate, type PoolInput, assemblePool } from "./pool"

const live = (niche: string, kind: LiveCandidate["kind"], n: number): LiveCandidate[] =>
  Array.from({ length: n }, (_, i) => ({
    niche,
    kind,
    id: `${niche}-${kind}-${i}`,
    imageUrl: `https://img/${niche}-${kind}-${i}.jpg`,
    label: `${niche} ${kind} ${i}`,
  }))

const input: PoolInput = {
  classic: [],
  lines: {
    rage: Array.from({ length: 10 }, (_, i) => `rage line number ${i}`),
    vamp: Array.from({ length: 10 }, (_, i) => `vamp line number ${i}`),
  },
  live: [...live("rage", "fit", 3), ...live("vamp", "fit", 3), ...live("vamp", "grail", 2)],
  adjacent: (slug) => (slug === "rage" ? ["jerk"] : ["goth"]),
  palette: () => ["#000", "#fff"],
  nicheImage: (slug) => `https://img/${slug}.jpg`,
}

describe("assemblePool", () => {
  it("builds line cards, live cards from real content, and this-or-that pairs", () => {
    const pool = assemblePool(input, seededRandom(1))
    const kinds = pool.map((card) => card.kind)
    expect(kinds.filter((k) => k === "line")).toHaveLength(2)
    expect(kinds).toContain("fit")
    expect(kinds).toContain("grail")
    const pair = pool.find((card) => card.kind === "pair")
    expect(pair?.pair?.a.weights).not.toEqual(pair?.pair?.b.weights)
  })

  it("captions live cards with the niche's own lines and credits the picture", () => {
    const pool = assemblePool(input, seededRandom(2))
    const grail = pool.find((card) => card.kind === "grail")
    expect(grail?.prompt).toMatch(/^vamp line number/)
    expect(grail?.credit).toMatch(/^vamp grail/)
    expect(grail?.weights).toEqual({ vamp: 3, goth: 1 })
  })

  it("never repeats a line within a session", () => {
    const prompts = assemblePool(input, seededRandom(3))
      .map((card) => card.prompt)
      .filter((p) => p.includes("line number"))
    expect(new Set(prompts).size).toBe(prompts.length)
  })

  it("rotates text and order between sessions", () => {
    const a = assemblePool(input, seededRandom(4)).map((c) => `${c.id}:${c.prompt}`)
    const b = assemblePool(input, seededRandom(5)).map((c) => `${c.id}:${c.prompt}`)
    expect(a).not.toEqual(b)
  })

  it("pairs looks from different scenes only", () => {
    for (const card of assemblePool(input, seededRandom(6))) {
      if (!card.pair) continue
      expect(Object.keys(card.pair.a.weights)[0]).not.toBe(Object.keys(card.pair.b.weights)[0])
    }
  })
})
