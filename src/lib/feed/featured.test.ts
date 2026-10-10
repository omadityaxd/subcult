import { describe, expect, it } from "vitest"
import { SEED_PROFILES } from "@/lib/niches/catalog"
import { featuredOrder, utcDay } from "./featured"

describe("featuredOrder", () => {
  it("includes every curated niche exactly once", () => {
    const slugs = featuredOrder(new Date("2026-10-10T08:00:00Z")).map((niche) => niche.slug)
    expect(new Set(slugs).size).toBe(SEED_PROFILES.length)
    expect(slugs.toSorted()).toEqual(SEED_PROFILES.map((p) => p.slug).toSorted())
  })

  it("is stable within a UTC day", () => {
    const morning = featuredOrder(new Date("2026-10-10T00:01:00Z"))
    const night = featuredOrder(new Date("2026-10-10T23:59:00Z"))
    expect(night).toEqual(morning)
  })

  it("reshuffles on a new day", () => {
    const today = featuredOrder(new Date("2026-10-10T12:00:00Z")).map((n) => n.slug)
    const tomorrow = featuredOrder(new Date("2026-10-11T12:00:00Z")).map((n) => n.slug)
    expect(tomorrow).not.toEqual(today)
  })

  it("formats the UTC day key", () => {
    expect(utcDay(new Date("2026-10-10T23:59:00Z"))).toBe("2026-10-10")
  })
})
