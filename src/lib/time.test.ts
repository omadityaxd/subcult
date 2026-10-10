import { describe, expect, it } from "vitest"
import { formatAge } from "./time"

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
