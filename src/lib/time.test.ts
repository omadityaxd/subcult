import { describe, expect, it } from "vitest"
import { formatAge, freshness, isNew, relativeAge } from "./time"

const NOW = new Date("2026-10-10T12:00:00Z")
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString()

describe("formatAge", () => {
  it.each([
    [ago(10_000), "just now"],
    [ago(5 * 60_000), "5m"],
    [ago(3 * 3_600_000), "3h"],
    [ago(2 * 86_400_000), "2d"],
    [ago(15 * 86_400_000), "2w"],
    ["2025-03-01T00:00:00Z", "Mar 2025"],
  ])("%s → %s", (iso, expected) => {
    expect(formatAge(iso, NOW)).toBe(expected)
  })

  it("returns null for missing or invalid dates", () => {
    expect(formatAge(null, NOW)).toBeNull()
    expect(formatAge("not a date", NOW)).toBeNull()
  })
})

describe("freshness", () => {
  const now = new Date("2026-10-16T12:00:00Z")
  const ago = (hours: number) => new Date(now.getTime() - hours * 3600_000).toISOString()

  it("buckets today, this week, older", () => {
    expect(freshness(ago(3), now)).toBe("today")
    expect(freshness(ago(30), now)).toBe("week")
    expect(freshness(ago(24 * 9), now)).toBe("older")
    expect(freshness(null, now)).toBe("older")
  })

  it("marks under-24h items new", () => {
    expect(isNew(ago(23), now)).toBe(true)
    expect(isNew(ago(25), now)).toBe(false)
  })

  it("reads relative ages for the sheet", () => {
    expect(relativeAge(ago(5), now)).toBe("5 hours ago")
    expect(relativeAge(ago(30), now)).toBe("yesterday")
    expect(relativeAge(ago(24 * 3), now)).toBe("3 days ago")
    expect(relativeAge(ago(24 * 20), now)).toBe("Sep 26")
  })
})
