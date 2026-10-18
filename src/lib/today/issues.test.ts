import { describe, expect, it } from "vitest"
import type { TodayEdition } from "./edition"
import {
  compactIssue,
  formatIssueNo,
  issueNumber,
  issueNumberFromCookie,
  localDay,
  recordIssue,
} from "./issues"

const edition: TodayEdition = {
  generatedAt: 0,
  mode: "day",
  cold: false,
  cover: { item: null, headline: "Today in jerk", lines: ["a", "b"] },
  sections: [
    {
      id: "tea",
      title: "The Tea",
      items: Array.from({ length: 5 }, (_, i) => ({
        id: `n${i}`,
        source: "news" as const,
        type: "article" as const,
        title: `story ${i}`,
        subtitle: "Complex",
        imageUrl: null,
        url: `https://x/${i}`,
        publishedAt: null,
        score: 1,
        meta: {},
      })),
    },
  ],
  backPage: { teaser: null },
  count: 5,
}

describe("issues", () => {
  it("numbers one issue per local day, from the first visit", () => {
    let archive = { issues: [] as ReturnType<typeof compactIssue>[] }
    expect(issueNumber(archive, "2026-10-18")).toBe(1)
    archive = recordIssue(archive, compactIssue(edition, 1, "2026-10-18"))
    expect(issueNumber(archive, "2026-10-18")).toBe(1)
    expect(issueNumber(archive, "2026-10-19")).toBe(2)
    // The same day is recorded once.
    expect(recordIssue(archive, compactIssue(edition, 9, "2026-10-18")).issues).toHaveLength(1)
  })

  it("keeps a compact copy: cover lines and three stories per section", () => {
    const record = compactIssue(edition, 3, "2026-10-18")
    expect(record.sections[0]?.stories.map((s) => s.title)).toEqual([
      "story 0",
      "story 1",
      "story 2",
    ])
    expect(record.lines).toEqual(["a", "b"])
  })

  it("formats numbers like a magazine and reads the masthead cookie safely", () => {
    expect(formatIssueNo(7)).toBe("007")
    expect(issueNumberFromCookie("7|2026-10-18", "2026-10-18")).toBe(7)
    expect(issueNumberFromCookie("7|2026-10-17", "2026-10-18")).toBe(8)
    expect(issueNumberFromCookie(undefined, "2026-10-18")).toBe(1)
    expect(issueNumberFromCookie("-3|x", "2026-10-18")).toBe(1)
  })

  it("uses the person's calendar day, not the server's", () => {
    // 20:00 UTC on the 17th is already the 18th in Kolkata.
    expect(localDay(Date.parse("2026-10-17T20:00:00Z"), "Asia/Kolkata")).toBe("2026-10-18")
    expect(localDay(Date.parse("2026-10-17T20:00:00Z"), "UTC")).toBe("2026-10-17")
  })
})
