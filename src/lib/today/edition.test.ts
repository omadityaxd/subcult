import { describe, expect, it } from "vitest"
import type { FeedItem } from "@/lib/feed/types"
import {
  type Candidates,
  TODAY_MAX,
  assembleEdition,
  localClock,
  sinceLabel,
  todayMode,
} from "./edition"

const item = (id: string, publishedAt: string | null = null): FeedItem => ({
  id,
  source: "news",
  type: "article",
  title: id,
  subtitle: null,
  imageUrl: null,
  url: "https://example.com",
  publishedAt,
  score: 1,
  meta: {},
})

const many = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => item(`${prefix}-${i}`))

const empty: Candidates = {
  digest: [],
  lateNight: [],
  drops: [],
  headlines: [],
  archive: [],
  fits: [],
  rising: [],
  friends: [],
  more: [],
}

describe("time of day", () => {
  it("reads the person's local clock, not the server's", () => {
    // 2026-10-16 is a Friday; 23:30 UTC = 05:00 Saturday in Kolkata.
    const now = Date.parse("2026-10-16T23:30:00Z")
    expect(localClock(now, "Asia/Kolkata")).toEqual({ hour: 5, weekday: 6 })
    expect(localClock(now, "America/New_York")).toEqual({ hour: 19, weekday: 5 })
    expect(localClock(now, "Not/AZone")).toEqual({ hour: 23, weekday: 5 })
  })

  it("picks night, then weekend, then morning", () => {
    expect(todayMode({ hour: 23, weekday: 6 })).toBe("night")
    expect(todayMode({ hour: 2, weekday: 2 })).toBe("night")
    expect(todayMode({ hour: 9, weekday: 0 })).toBe("weekend")
    expect(todayMode({ hour: 8, weekday: 3 })).toBe("morning")
    expect(todayMode({ hour: 15, weekday: 3 })).toBe("day")
  })
})

describe("assembleEdition", () => {
  const full: Candidates = {
    digest: many("digest", 5),
    lateNight: many("night", 10),
    drops: many("drop", 10),
    headlines: many("news", 10),
    archive: many("listing", 10),
    fits: many("fit", 10),
    rising: [{ entity: "niche:rage", label: "rage", ratio: 2.4, href: "/n/rage" }],
    friends: [
      { entity: "artist:nettspend", label: "Nettspend", handles: ["a", "b"], href: "/n/jerk" },
    ],
    more: many("more", 30),
  }

  it("is finite: never more than 25 items", () => {
    for (const mode of ["morning", "day", "night", "weekend"] as const) {
      expect(assembleEdition(full, { now: 0, mode, cold: false }).count).toBeLessThanOrEqual(
        TODAY_MAX,
      )
    }
  })

  it("orders sections by the moment", () => {
    const ids = (mode: "morning" | "night" | "weekend") =>
      assembleEdition(full, { now: 0, mode, cold: false }).sections.map((s) => s.id)
    expect(ids("morning")[0]).toBe("digest")
    expect(ids("night")[0]).toBe("late-night")
    expect(ids("weekend").slice(0, 2)).toEqual(["fits", "archive"])
  })

  it("keeps the late-night rotation to nights and weekends", () => {
    const day = assembleEdition(full, { now: 0, mode: "day", cold: false })
    expect(day.sections.some((s) => s.id === "late-night")).toBe(false)
  })

  it("never shows an item twice and drops empty sections", () => {
    const shared = item("same")
    const edition = assembleEdition(
      { ...empty, headlines: [shared], digest: [shared] },
      { now: 0, mode: "morning", cold: false },
    )
    expect(edition.sections.map((s) => s.id)).toEqual(["digest"])
    expect(edition.count).toBe(1)
  })

  it("puts the newest drops first", () => {
    const edition = assembleEdition(
      {
        ...empty,
        drops: [item("old", "2026-10-01T00:00:00Z"), item("new", "2026-10-15T00:00:00Z")],
      },
      { now: 0, mode: "day", cold: false },
    )
    expect(edition.sections[0]?.items.map((i) => i.id)).toEqual(["new", "old"])
  })
})

describe("sinceLabel", () => {
  const now = Date.parse("2026-10-16T12:00:00Z") // a Friday
  it("names the day of the last visit in the person's zone", () => {
    expect(sinceLabel(Date.parse("2026-10-13T12:00:00Z"), now, "UTC")).toBe(
      "since you were here Tuesday",
    )
    expect(sinceLabel(Date.parse("2026-10-15T12:00:00Z"), now, "UTC")).toBe(
      "since you were here yesterday",
    )
    expect(sinceLabel(Date.parse("2026-10-16T08:00:00Z"), now, "UTC")).toBe("since earlier today")
    expect(sinceLabel(Date.parse("2026-09-01T08:00:00Z"), now, "UTC")).toBe("since your last visit")
  })
})

describe("quiet days", () => {
  it("tops up to the minimum from the person's scenes, never beyond", () => {
    const edition = assembleEdition(
      { ...empty, drops: many("drop", 2), more: many("more", 40) },
      { now: 0, mode: "day", cold: false },
    )
    expect(edition.count).toBe(15)
    expect(edition.sections.map((s) => s.id)).toEqual(["drops", "more"])
  })

  it("adds nothing when the day is already full", () => {
    const edition = assembleEdition(
      {
        ...empty,
        headlines: many("news", 6),
        drops: many("drop", 6),
        fits: many("fit", 6),
        more: many("more", 9),
      },
      { now: 0, mode: "day", cold: false },
    )
    expect(edition.sections.some((s) => s.id === "more")).toBe(false)
  })
})

describe("friends row", () => {
  it("shows what friends are into when there is something, never otherwise", () => {
    const chip = {
      entity: "artist:nettspend",
      label: "Nettspend",
      handles: ["sam"],
      href: "/n/jerk",
    }
    const withFriends = assembleEdition(
      { ...empty, friends: [chip] },
      { now: 0, mode: "day", cold: false },
    )
    expect(withFriends.sections.find((s) => s.id === "friends")?.friends).toEqual([chip])
    const alone = assembleEdition(empty, { now: 0, mode: "day", cold: false })
    expect(alone.sections.some((s) => s.id === "friends")).toBe(false)
  })
})
