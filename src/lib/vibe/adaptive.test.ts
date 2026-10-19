import { describe, expect, it } from "vitest"
import { type AdaptiveCard, MAX_CARDS, MIN_CARDS, isDone, nextCard, seededRandom } from "./adaptive"
import type { Answer } from "./score"

const SCENES = ["rage", "vamp", "jerk", "plugg", "archive", "trap", "goth", "y2k"]
/** A pool with one strong card per scene, plus cards that mix two scenes. */
const pool: AdaptiveCard[] = [
  ...SCENES.flatMap((slug, i) => [
    { id: `${slug}-1`, kind: "line", weights: { [slug]: 3 } },
    { id: `${slug}-2`, kind: "fit", weights: { [slug]: 3, [SCENES[(i + 1) % SCENES.length]]: 1 } },
    { id: `${slug}-3`, kind: "pin", weights: { [slug]: 2 } },
  ]),
  {
    id: "pair-rage-vamp",
    kind: "pair",
    weights: {},
    pair: { a: { weights: { rage: 3 } }, b: { weights: { vamp: 3 } } },
  },
]

/** Plays a whole deck as someone who is exactly `self`. */
function play(self: ReadonlySet<string>, seed: number): { id: string; answer: Answer }[] {
  const random = seededRandom(seed)
  const history: { id: string; answer: Answer }[] = []
  for (let card = nextCard(pool, history, random); card; card = nextCard(pool, history, random)) {
    const answer: Answer = card.pair
      ? Object.keys(card.pair.a.weights).some((s) => self.has(s))
        ? "a"
        : "b"
      : Object.entries(card.weights).some(([s, w]) => self.has(s) && w >= 2)
        ? "like"
        : "pass"
    history.push({ id: card.id, answer })
  }
  return history
}

describe("adaptive vibe deck", () => {
  it("stops between 10 and 16 cards", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const length = play(new Set(["rage", "vamp"]), seed).length
      expect(length).toBeGreaterThanOrEqual(MIN_CARDS)
      expect(length).toBeLessThanOrEqual(MAX_CARDS)
    }
  })

  it("stops early once a clear taste emerges", () => {
    expect(play(new Set(["rage", "vamp", "jerk"]), 7).length).toBeLessThan(MAX_CARDS)
  })

  it("narrows onto the front-runners after exploring", () => {
    const history = play(new Set(["rage"]), 11)
    const late = history.slice(6).map((h) => pool.find((c) => c.id === h.id)!)
    const aboutRage = late.filter(
      (c) => (c.weights.rage ?? 0) > 0 || (c.pair?.a.weights.rage ?? 0) > 0,
    ).length
    // Rage cards are 5 of 25 (20%) in the pool; the narrowed deck asks about it far more often.
    expect(aboutRage / late.length).toBeGreaterThan(0.2)
  })

  it("serves a different deck each session", () => {
    const decks = [21, 22, 23].map((seed) =>
      play(new Set(["plugg"]), seed)
        .map((h) => h.id)
        .join(","),
    )
    expect(new Set(decks).size).toBeGreaterThan(1)
  })

  it("never asks the same card twice", () => {
    const ids = play(new Set(["goth"]), 3).map((h) => h.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("isn't done before the minimum, however confident", () => {
    const answers = Object.fromEntries(pool.slice(0, 5).map((c) => [c.id, "like" as const]))
    expect(isDone(pool, answers, 5)).toBe(false)
  })
})
