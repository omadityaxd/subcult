import { describe, expect, it } from "vitest"
import { latestVibeMix } from "./account-mix"

const signal = (kind: string, entity: string, strength: number, at: number) => ({
  kind,
  entity,
  strength,
  at,
})

describe("latestVibeMix", () => {
  it("is null for an account that never took the vibe check", () => {
    expect(latestVibeMix([])).toBeNull()
    expect(latestVibeMix([signal("play", "niche:rage", 1, 5)])).toBeNull()
  })

  it("takes the most recent check, biggest share first", () => {
    expect(
      latestVibeMix([
        signal("vibe_check", "niche:goth", 0.6, 100), // an older check
        signal("vibe_check", "niche:jerk", 0.25, 200),
        signal("vibe_check", "niche:rage", 0.55, 200),
        signal("vibe_check", "niche:vamp", 0.2, 200),
        signal("save", "artist:ken-carson", 1, 300),
      ]),
    ).toEqual(["rage", "jerk", "vamp"])
  })
})
