const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

/** Compact feed-style age: "just now", "5m", "3h", "2d", "3w", then "Mar 2025". */
export function formatAge(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const age = now.getTime() - date.getTime()
  if (age < MINUTE) return "just now"
  if (age < HOUR) return `${Math.floor(age / MINUTE)}m`
  if (age < DAY) return `${Math.floor(age / HOUR)}h`
  if (age < WEEK) return `${Math.floor(age / DAY)}d`
  if (age < 5 * WEEK) return `${Math.floor(age / WEEK)}w`
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
}

export type Freshness = "today" | "week" | "older"

/** Bucket for "Today" / "This week" section labels (rolling 24h and 7 days). */
export function freshness(iso: string | null, now: Date = new Date()): Freshness {
  if (!iso) return "older"
  const age = now.getTime() - new Date(iso).getTime()
  if (Number.isNaN(age)) return "older"
  if (age < DAY) return "today"
  return age < WEEK ? "week" : "older"
}

/** Under 24 hours old: gets the "new" dot. */
export const isNew = (iso: string | null, now: Date = new Date()): boolean =>
  freshness(iso, now) === "today"

/** Sheet-style age: "2 hours ago", "yesterday", "3 days ago", else the date. */
export function relativeAge(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null
  const date = new Date(iso)
  const age = now.getTime() - date.getTime()
  if (Number.isNaN(age)) return null
  if (age < HOUR) return age < 2 * MINUTE ? "just now" : `${Math.floor(age / MINUTE)} minutes ago`
  if (age < DAY) return age < 2 * HOUR ? "1 hour ago" : `${Math.floor(age / HOUR)} hours ago`
  if (age < 2 * DAY) return "yesterday"
  if (age < WEEK) return `${Math.floor(age / DAY)} days ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}
