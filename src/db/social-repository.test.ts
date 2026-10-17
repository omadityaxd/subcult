import { describe, expect, it } from "vitest"
import { canView } from "./social-repository"

const rel = (over: Partial<Parameters<typeof canView>[1]>) => ({
  self: false,
  following: false,
  followedBy: false,
  blocked: false,
  ...over,
})

describe("canView", () => {
  it("public profiles are visible to anyone not blocked", () => {
    expect(canView("public", rel({}))).toBe(true)
    expect(canView("public", rel({ blocked: true }))).toBe(false)
  })

  it("friends-only means mutual follows (and yourself)", () => {
    expect(canView("friends", rel({ self: true }))).toBe(true)
    expect(canView("friends", rel({ following: true }))).toBe(false)
    expect(canView("friends", rel({ followedBy: true }))).toBe(false)
    expect(canView("friends", rel({ following: true, followedBy: true }))).toBe(true)
    expect(canView("friends", rel({ following: true, followedBy: true, blocked: true }))).toBe(
      false,
    )
  })
})
