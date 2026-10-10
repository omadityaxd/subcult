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
