import { describe, expect, it } from "vitest"
import { encodeTasteCookie, parsePreviousVisit, parseTasteCookie } from "./cookies"

describe("taste cookie", () => {
  it("round-trips the strongest entities", () => {
    const encoded = encodeTasteCookie([
      { ref: "artist:nettspend", score: 3.8123 },
      { ref: "niche:jerk", score: 6.9 },
      { ref: "niche:rage", score: -5 },
    ])
    expect(encoded).toBe("niche:jerk~6.9|niche:rage~-5|artist:nettspend~3.81")
    expect(parseTasteCookie(encoded)).toEqual([
      { ref: "niche:jerk", score: 6.9 },
      { ref: "niche:rage", score: -5 },
      { ref: "artist:nettspend", score: 3.81 },
    ])
  })

  it("drops anything malformed and stays small", () => {
    expect(parseTasteCookie("niche:jerk~1|<script>~2|artist:x~NaN|brand:ok~1e9")).toEqual([
      { ref: "niche:jerk", score: 1 },
    ])
    const many = Array.from({ length: 200 }, (_, i) => ({ ref: `artist:a${i}` as const, score: i }))
    expect(encodeTasteCookie(many).length).toBeLessThanOrEqual(3000)
    expect(parseTasteCookie("x".repeat(5000))).toEqual([])
  })

  it("only trusts sane visit times", () => {
    const now = Date.parse("2026-10-17T12:00:00Z")
    expect(parsePreviousVisit(String(now - 1000), now)).toBe(now - 1000)
    expect(parsePreviousVisit(String(now + 1000), now)).toBeNull()
    expect(parsePreviousVisit("abc", now)).toBeNull()
    expect(parsePreviousVisit(undefined, now)).toBeNull()
  })
})
