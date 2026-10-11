import { describe, expect, it } from "vitest"
import {
  type ListenEvent,
  dayKey,
  emptyWrapped,
  recordListen,
  recordVisit,
  summarize,
  wrappedDataSchema,
} from "./stats"

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 11, 12)

const listen = (
  niche: string | null,
  artist = "Ken Carson",
  trackId = `${artist}-1`,
): ListenEvent => ({
  trackId,
  title: `${artist} song`,
  artist,
  artworkUrl: null,
  niche,
})

describe("wrapped reducers", () => {
  it("accumulates listening per day, niche, artist and track", () => {
    let data = emptyWrapped(NOW)
    data = recordListen(data, listen("rage"), 30, NOW)
    data = recordListen(data, listen("rage"), 30, NOW)
    data = recordListen(data, listen("vamp", "Che"), 15, NOW)
    expect(data.days[dayKey(NOW)]).toEqual({ rage: 60, vamp: 15 })
    expect(data.artists).toEqual({ "Ken Carson": 60, Che: 15 })
    expect(data.tracks["Ken Carson-1"].seconds).toBe(60)
    expect(wrappedDataSchema.safeParse(data).success).toBe(true)
  })

  it("ignores non-positive seconds and never mutates the input", () => {
    const data = emptyWrapped(NOW)
    expect(recordListen(data, listen("rage"), 0, NOW)).toBe(data)
    const next = recordListen(data, listen("rage"), 5, NOW)
    expect(data.days).toEqual({})
    expect(next).not.toBe(data)
  })

  it("counts visits and keeps the first-seen date", () => {
    let data = recordVisit(emptyWrapped(NOW), "rage", NOW)
    data = recordVisit(data, "rage", NOW + DAY)
    expect(data.niches.rage).toEqual({ visits: 2, firstSeen: NOW })
  })
})

describe("summarize", () => {
  it("ranks top niches by listening plus visits and sums them to 100", () => {
    let data = emptyWrapped(NOW - 20 * DAY)
    data = recordListen(data, listen("rage"), 600, NOW)
    data = recordListen(data, listen("vamp", "Che"), 300, NOW - 2 * DAY)
    data = recordVisit(data, "deftones-core", NOW)
    const summary = summarize(data, NOW)
    expect(summary.topNiches.map((n) => n.slug)).toEqual(["rage", "vamp", "deftones-core"])
    expect(summary.topNiches.reduce((sum, n) => sum + n.percent, 0)).toBe(100)
    expect(summary.minutesListened).toBe(15)
    expect(summary.topArtists[0]).toEqual({ name: "Ken Carson", minutes: 10 })
    expect(summary.nichesDiscovered).toBe(1)
    expect(summary.hasData).toBe(true)
  })

  it("gives this week's split and an era only when one niche clearly leads", () => {
    let data = emptyWrapped(NOW - 40 * DAY)
    data = recordListen(data, listen("rage"), 700, NOW)
    data = recordListen(data, listen("vamp", "Che"), 300, NOW - DAY)
    data = recordListen(data, listen("jerk", "Nettspend"), 5000, NOW - 35 * DAY) // outside the month
    const summary = summarize(data, NOW)
    expect(summary.week).toEqual([
      { slug: "rage", percent: 70 },
      { slug: "vamp", percent: 30 },
    ])
    expect(summary.era).toEqual({ slug: "rage", share: 70 })

    let even = emptyWrapped(NOW)
    for (const slug of ["rage", "vamp", "jerk", "plugg"])
      even = recordListen(even, listen(slug), 100, NOW)
    expect(summarize(even, NOW).era).toBeNull()
  })

  it("is empty for a fresh install", () => {
    const summary = summarize(emptyWrapped(NOW), NOW)
    expect(summary).toMatchObject({
      hasData: false,
      minutesListened: 0,
      topNiches: [],
      week: [],
      era: null,
    })
  })
})
