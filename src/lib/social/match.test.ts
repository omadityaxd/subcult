import { describe, expect, it } from "vitest"
import type { EntityRef } from "@/lib/taste/entities"
import type { Affinity, TasteVector } from "@/lib/taste/model"
import { matchPercent, vibeMatch } from "./match"

const vector = (entries: [EntityRef, number][]): TasteVector =>
  new Map(
    entries.map(([entity, score]): [EntityRef, Affinity] => [
      entity,
      { entity, label: entity.split(":")[1] ?? entity, score, because: "save" },
    ]),
  )

const jerkKid = vector([
  ["niche:jerk", 7],
  ["artist:nettspend", 4],
  ["brand:rick-owens", 3],
  ["artist:fakemink", 2],
])

describe("matchPercent", () => {
  it("is 100 for the same taste and 0 for nothing shared", () => {
    expect(matchPercent(jerkKid, jerkKid)).toBe(100)
    expect(matchPercent(jerkKid, vector([["niche:cottagecore", 5]]))).toBe(0)
    expect(matchPercent(jerkKid, new Map())).toBe(0)
  })

  it("is symmetric and grows with overlap", () => {
    const close = vector([
      ["niche:jerk", 5],
      ["artist:nettspend", 3],
      ["artist:ken-carson", 3],
    ])
    const far = vector([
      ["niche:jerk", 1],
      ["niche:cottagecore", 6],
    ])
    expect(matchPercent(jerkKid, close)).toBe(matchPercent(close, jerkKid))
    expect(matchPercent(jerkKid, close)).toBeGreaterThan(matchPercent(jerkKid, far))
  })

  it("ignores dislikes", () => {
    const dislikes = vector([
      ["niche:jerk", 7],
      ["niche:rage", -5],
    ])
    expect(matchPercent(dislikes, vector([["niche:jerk", 2]]))).toBe(100)
  })
})

describe("vibeMatch", () => {
  it("lists what you share and one thing they'd put you on", () => {
    const them = vector([
      ["niche:jerk", 5],
      ["artist:nettspend", 2],
      ["artist:osamason", 6],
      ["niche:rage", 1],
    ])
    const match = vibeMatch(jerkKid, them)
    expect(match.sharedNiches.map((n) => n.ref)).toEqual(["niche:jerk"])
    expect(match.sharedArtists.map((a) => a.ref)).toEqual(["artist:nettspend"])
    expect(match.putYouOn?.ref).toBe("artist:osamason")
  })

  it("never 'puts you on' something you already skipped", () => {
    const me = new Map([...jerkKid, ...vector([["artist:osamason", -1]])])
    const them = vector([["artist:osamason", 6]])
    expect(vibeMatch(me, them).putYouOn).toBeNull()
  })
})
