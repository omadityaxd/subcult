import { describe, expect, it } from "vitest"
import { RECHECK_DAYS, eraShift, recheckDue } from "./era"

const name = (slug: string) => slug

describe("eraShift", () => {
  it("says nothing on a first check", () => {
    expect(eraShift(null, [{ slug: "rage", percent: 100 }], name)).toBeNull()
  })

  it("names a new top niche", () => {
    expect(
      eraShift(
        [
          { slug: "rage", percent: 60 },
          { slug: "vamp", percent: 40 },
        ],
        [
          { slug: "vamp", percent: 55 },
          { slug: "rage", percent: 45 },
        ],
        name,
      ),
    ).toBe("Your era shifted: rage → vamp.")
  })

  it("reports the biggest move when the top stays", () => {
    expect(
      eraShift(
        [
          { slug: "rage", percent: 50 },
          { slug: "vamp", percent: 30 },
          { slug: "jerk", percent: 20 },
        ],
        [
          { slug: "rage", percent: 48 },
          { slug: "jerk", percent: 40 },
          { slug: "plugg", percent: 12 },
        ],
        name,
      ),
    ).toBe("Your era shifted: vamp is down 30 points since last time.")
  })

  it("calls small wobbles the same era", () => {
    expect(
      eraShift(
        [
          { slug: "rage", percent: 50 },
          { slug: "vamp", percent: 50 },
        ],
        [
          { slug: "rage", percent: 52 },
          { slug: "vamp", percent: 48 },
        ],
        name,
      ),
    ).toBe("Same era as last time: still rage.")
  })
})

describe("recheckDue", () => {
  const DAY = 24 * 3600_000
  it("asks after a week, or when there's no check yet", () => {
    expect(recheckDue(null, 0)).toBe(true)
    expect(recheckDue(0, (RECHECK_DAYS - 1) * DAY)).toBe(false)
    expect(recheckDue(0, RECHECK_DAYS * DAY)).toBe(true)
  })
})
