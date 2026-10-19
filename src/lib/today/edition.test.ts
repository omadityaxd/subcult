import { describe, expect, it } from "vitest"
import type { FeedItem } from "@/lib/feed/types"
import {
  type Candidates,
  SECTION_CAPS,
  TODAY_MAX,
  assembleEdition,
  localClock,
  pickCover,
  sinceLabel,
  todayMode,
} from "./edition"

const item = (id: string, over: Partial<FeedItem> = {}): FeedItem => ({
  id,
  source: "news",
  type: "article",
  title: id,
  subtitle: null,
  imageUrl: null,
  url: "https://example.com",
  publishedAt: null,
  score: 1,
  meta: {},
  ...over,
})

const many = (prefix: string, n: number, over: Partial<FeedItem> = {}) =>
  Array.from({ length: n }, (_, i) => item(`${prefix}-${i}`, over))

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

const opts = { now: 0, mode: "day" as const, cold: false }

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
    expect(todayMode({ hour: 9, weekday: 0 })).toBe("weekend")
    expect(todayMode({ hour: 8, weekday: 3 })).toBe("morning")
    expect(todayMode({ hour: 15, weekday: 3 })).toBe("day")
  })
})

describe("the issue", () => {
  const full: Candidates = {
    digest: many("digest", 3, { imageUrl: "https://img/news.jpg" }),
    lateNight: many("night", 10, { source: "spotify", type: "track" }),
    drops: many("drop", 10, { source: "subcult", type: "release" }),
    headlines: many("news", 10),
    archive: many("listing", 10, {
      source: "ebay",
      type: "product",
      imageUrl: "https://img/l.jpg",
    }),
    fits: many("fit", 10, { source: "subcult", type: "fit", imageUrl: "https://img/f.jpg" }),
    rising: [
      { entity: "artist:destroy-lonely", label: "Destroy Lonely", ratio: 2.3, href: "/n/vamp" },
    ],
    friends: [],
    more: many("more", 30),
  }

  it("runs in magazine order and is finite", () => {
    for (const mode of ["morning", "day", "night", "weekend"] as const) {
      const issue = assembleEdition(full, { ...opts, mode })
      expect(issue.sections.map((s) => s.id)).toEqual(["tea", "fit", "grail", "sound", "scene"])
      expect(issue.count).toBeLessThanOrEqual(TODAY_MAX)
    }
  })

  it("covers with a fit first, then a grail, then a story with an image, never music", () => {
    expect(pickCover(full)?.id).toBe("fit-0")
    expect(pickCover({ ...full, fits: [] })?.id).toBe("listing-0")
    expect(pickCover({ ...full, fits: [], archive: [] })?.id).toBe("digest-0")
    expect(pickCover({ ...empty, lateNight: full.lateNight, drops: full.drops })).toBeNull()
  })

  it("never covers with, or leads the cover lines with, heavy news", () => {
    const heavy = {
      ...full.digest[0]!,
      id: "heavy",
      title: "Rapper arrested",
      meta: { heavy: true },
    }
    const light = { ...full.digest[0]!, id: "light", title: "New collection drops" }
    const c = { ...full, fits: [], archive: [], digest: [heavy, light], headlines: [heavy, light] }
    expect(pickCover(c)?.id).toBe("light")
    const issue = assembleEdition(c, opts)
    expect(issue.cover.lines).not.toContain("Rapper arrested")
  })

  it("never covers with a YouTube thumbnail, or anything the quality check rejects", () => {
    const thumb = (id: string) => ({
      ...full.fits[0]!,
      id,
      imageUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    })
    expect(pickCover({ ...full, fits: [thumb("yt1")] })?.id).toBe("listing-0")
    expect(pickCover({ ...empty, fits: [thumb("yt1")] })).toBeNull()
    expect(pickCover(full, () => false)).toBeNull()
  })

  it("never repeats the cover inside a section, and lists the three biggest stories", () => {
    const issue = assembleEdition(full, opts)
    const ids = issue.sections.flatMap((s) => s.items.map((i) => i.id))
    expect(ids).not.toContain("fit-0")
    expect(issue.cover.lines).toEqual([
      "digest-0",
      "New: drop-0",
      "Destroy Lonely is up 2.3× this week",
    ])
  })

  it("caps The Sound at five tracks: a magazine, not a playlist", () => {
    const issue = assembleEdition(full, { ...opts, mode: "night" })
    expect(issue.sections.find((s) => s.id === "sound")?.items).toHaveLength(SECTION_CAPS.sound)
  })

  it("never tops up with tracks", () => {
    const issue = assembleEdition(
      {
        ...empty,
        more: [...many("t", 20, { source: "spotify", type: "track" }), ...many("v", 20)],
      },
      opts,
    )
    const scene = issue.sections.find((s) => s.id === "scene")
    expect(scene?.items.every((i) => i.type !== "track")).toBe(true)
  })

  it("teases tomorrow only from real momentum", () => {
    expect(assembleEdition(full, opts).backPage.teaser).toBe(
      "Watching tomorrow: Destroy Lonely (2.3× this week)",
    )
    expect(assembleEdition(empty, opts).backPage.teaser).toBeNull()
  })

  it("falls back to a niche headline with a palette cover", () => {
    const issue = assembleEdition(empty, { ...opts, nicheName: "jerk" })
    expect(issue.cover.item).toBeNull()
    expect(issue.cover.headline).toBe("Today in jerk")
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
  })
})

describe("cover editorial rules", () => {
  it("keeps gossip off the cover and the cover lines", () => {
    const gossip = item("g", {
      title: "Violet Myers Calls Out OsamaSon on Instagram",
      imageUrl: "https://img/g.jpg",
    })
    const story = item("s", { title: "Rick Owens SS27", imageUrl: "https://img/s.jpg" })
    const issue = assembleEdition({ ...empty, headlines: [gossip, story] }, opts)
    expect(issue.cover.item?.id).toBe("s")
    expect(issue.cover.lines).not.toContain(gossip.title)
  })
})
