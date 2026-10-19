import { describe, expect, it } from "vitest"
import type { EntityRef } from "@/lib/taste/entities"
import { type EntityEvent, computeMomentum, mentions, momentumReason, rising } from "./momentum"

const DAY = 24 * 3600_000
const NOW = Date.parse("2026-10-16T12:00:00Z")

const events = (
  entity: EntityRef,
  source: EntityEvent["source"],
  daysAgo: readonly number[],
): EntityEvent[] =>
  daysAgo.map((d) => ({ entity, label: entity, niche: "rage", source, at: NOW - d * DAY }))

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)

describe("momentum", () => {
  it("rises when this week's rate beats the month before", () => {
    const [m] = computeMomentum(
      [
        ...events("artist:hot", "headline", [1, 2, 2, 3, 4, 5, 6, 6]),
        ...events("artist:hot", "headline", [10, 20]),
      ],
      NOW,
    )
    expect(m?.last7).toBe(8)
    expect(m?.prior28).toBe(2)
    expect(m?.ratio).toBeGreaterThan(3)
  })

  it("a steady entity isn't rising, however loud", () => {
    // One headline a day for five weeks.
    const steady = events("artist:steady", "headline", range(0, 34))
    expect(rising(steady, NOW)).toEqual([])
    expect(computeMomentum(steady, NOW)[0]?.ratio).toBeCloseTo(1, 1)
  })

  it("one headline after silence isn't a trend", () => {
    expect(rising(events("artist:blip", "headline", [1, 2]), NOW)).toEqual([])
  })

  it("weights releases over headlines and ignores events outside five weeks", () => {
    const [m] = computeMomentum(
      [...events("artist:x", "release", [1]), ...events("artist:x", "headline", [60])],
      NOW,
    )
    expect(m?.last7).toBe(3)
    expect(m?.prior28).toBe(0)
  })

  it("ranks by score: momentum with volume", () => {
    const top = rising(
      [
        ...events(
          "artist:big",
          "headline",
          range(0, 6).flatMap((d) => [d, d, d]),
        ),
        ...events("artist:small", "headline", [0, 1, 2]),
      ],
      NOW,
    )
    expect(top.map((m) => m.entity)).toEqual(["artist:big", "artist:small"])
  })
})

describe("mentions", () => {
  it("dates each entity named in a title, skipping undated items", () => {
    const found = mentions(
      [
        { title: "Ken Carson drops a new single", at: NOW - DAY },
        { title: "Ken Carson tour", at: null },
      ],
      [{ ref: "artist:ken-carson", label: "Ken Carson", match: (t) => t.includes("Ken Carson") }],
      "rage",
      "headline",
    )
    expect(found).toEqual([
      {
        entity: "artist:ken-carson",
        label: "Ken Carson",
        niche: "rage",
        source: "headline",
        at: NOW - DAY,
      },
    ])
  })
})

describe("momentumReason", () => {
  it("says what actually happened this week, in plain counts", () => {
    expect(momentumReason({ week: { headline: 3, release: 1 } })).toBe(
      "3 new headlines + 1 release this week",
    )
    expect(momentumReason({ week: { save: 1 } })).toBe("1 save on subcult this week")
  })

  it("is null with nothing counted (old snapshots have no counts)", () => {
    expect(momentumReason({})).toBeNull()
    expect(momentumReason({ week: { headline: 0 } })).toBeNull()
  })

  it("counts only last week's events, unweighted", () => {
    const at = (days: number) => NOW - days * 24 * 3600_000
    const events: EntityEvent[] = [
      { entity: "artist:x", label: "X", niche: "rage", source: "release", at: at(1) },
      { entity: "artist:x", label: "X", niche: "rage", source: "headline", at: at(2) },
      { entity: "artist:x", label: "X", niche: "rage", source: "headline", at: at(20) },
    ]
    expect(computeMomentum(events, NOW)[0]?.week).toEqual({ release: 1, headline: 1 })
  })
})
