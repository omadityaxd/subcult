import type { TodayEdition } from "./edition"

/**
 * Issue numbers and the archive of past issues. Each day you open subcult
 * is a new issue (No. 001, 002, …), numbered from your first visit. Past
 * issues are kept compact (cover, cover lines, a few stories per section)
 * so dozens fit on the device.
 */
export const ISSUES_KEY = "subcult-issues-v1"
export const ISSUE_COOKIE = "sc_issue"
const MAX_KEPT = 60
const STORIES_PER_SECTION = 3

export interface IssueStory {
  title: string
  url: string
  imageUrl: string | null
  source: string
}

export interface IssueRecord {
  no: number
  /** Local calendar day, YYYY-MM-DD. */
  day: string
  mode: TodayEdition["mode"]
  headline: string
  lines: string[]
  coverImage: string | null
  sections: { id: string; title: string; stories: IssueStory[] }[]
}

export interface IssueArchive {
  issues: IssueRecord[]
}

/** The person's local calendar day. */
export function localDay(now: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short" }).format(now)
  } catch {
    return new Date(now).toISOString().slice(0, 10)
  }
}

/** Issue number for `day`: today's if already recorded, else the next one. */
export function issueNumber(archive: IssueArchive, day: string): number {
  const today = archive.issues.find((issue) => issue.day === day)
  if (today) return today.no
  return (archive.issues.reduce((max, issue) => Math.max(max, issue.no), 0) || 0) + 1
}

export function compactIssue(edition: TodayEdition, no: number, day: string): IssueRecord {
  return {
    no,
    day,
    mode: edition.mode,
    headline: edition.cover.headline,
    lines: edition.cover.lines,
    coverImage: edition.cover.item?.imageUrl ?? null,
    sections: edition.sections.map((section) => ({
      id: section.id,
      title: section.title,
      stories: section.items.slice(0, STORIES_PER_SECTION).map((item) => ({
        title: item.title,
        url: item.url,
        imageUrl: item.imageUrl,
        source: item.subtitle ?? item.source,
      })),
    })),
  }
}

/** Records today's issue once (first render of the day wins); returns the new archive. */
export function recordIssue(archive: IssueArchive, record: IssueRecord): IssueArchive {
  if (archive.issues.some((issue) => issue.day === record.day)) return archive
  return { issues: [record, ...archive.issues].slice(0, MAX_KEPT) }
}

/** "007": issue numbers read like a magazine's. */
export const formatIssueNo = (no: number): string => String(no).padStart(3, "0")

/** Cookie for the server's masthead: "7|2026-10-18" (last recorded number and its day). */
export function encodeIssueCookie(no: number, day: string): string {
  return `${no}|${day}`
}

export function issueNumberFromCookie(raw: string | undefined, today: string): number {
  const [noText, day] = (raw ?? "").split("|")
  const no = Number(noText)
  if (!Number.isInteger(no) || no < 1 || no > 100_000 || !day) return 1
  return day === today ? no : no + 1
}
