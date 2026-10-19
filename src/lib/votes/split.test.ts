import { describe, expect, it } from "vitest"
import { VOTE_TARGET, splitOf } from "./split"

describe("splitOf", () => {
  it("reports the real share of cops", () => {
    expect(splitOf({ cop: 5, drop: 3 }, "cop")).toEqual({ total: 8, pct: 63 })
  })

  it("reads polls as a vs b", () => {
    expect(splitOf({ a: 1, b: 3, cop: 9 }, "a")).toEqual({ total: 4, pct: 25 })
  })

  it("has no percentage to invent before anyone votes", () => {
    expect(splitOf({}, "cop")).toEqual({ total: 0, pct: 0 })
  })
})

describe("VOTE_TARGET", () => {
  it("accepts our feed ids and polls, and nothing else", () => {
    expect(VOTE_TARGET.test("ebay:v1|1234|0")).toBe(true)
    expect(VOTE_TARGET.test("spotify:track:4uLU6hMCjMI75M1A2tKUQC")).toBe(true)
    expect(VOTE_TARGET.test("poll:fit:abc|pin:arena:9")).toBe(true)
  })

  it("never rates people", () => {
    expect(VOTE_TARGET.test("user:someone")).toBe(false)
    expect(VOTE_TARGET.test("spotify:artist:abc")).toBe(false)
    expect(VOTE_TARGET.test("subcult:artist:bladee")).toBe(false)
    expect(VOTE_TARGET.test("poll:fit:abc|subcult:artist:bladee")).toBe(false)
  })

  it("rejects anything that isn't an item id", () => {
    expect(VOTE_TARGET.test("<script>")).toBe(false)
    expect(VOTE_TARGET.test("fit:" + "x".repeat(300))).toBe(false)
  })
})
