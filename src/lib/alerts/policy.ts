import { localClock } from "@/lib/today/edition"

/**
 * When and how alerts reach a person. Pure, so the rules are tested: quiet
 * hours in their own time zone, one push a day (batched), a niche "blowing
 * up" at most once a week, and grail matching that never guesses a size.
 */

export const ALERT_TYPES = ["drop", "grail", "niche", "friend"] as const
export type AlertType = (typeof ALERT_TYPES)[number]

export const DEFAULT_QUIET_START = 23 * 60
export const DEFAULT_QUIET_END = 9 * 60
const DAY_MS = 24 * 3600_000
export const PUSH_GAP_MS = DAY_MS
export const NICHE_ALERT_GAP_MS = 7 * DAY_MS
/** Momentum a followed niche needs to count as "blowing up". */
export const NICHE_ALERT_RATIO = 2.5

/** Minutes since local midnight, within [start, end) wrapping past midnight. */
export function inQuietHours(
  now: number,
  timeZone: string,
  start = DEFAULT_QUIET_START,
  end = DEFAULT_QUIET_END,
): boolean {
  if (start === end) return false
  const { hour } = localClock(now, timeZone)
  const minute = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: safeZone(timeZone), minute: "numeric" }).format(
      now,
    ),
  )
  const t = hour * 60 + minute
  return start < end ? t >= start && t < end : t >= start || t < end
}

function safeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0)
    return timeZone
  } catch {
    return "UTC"
  }
}

/** One push per day per person: everything else waits in the notification center. */
export const pushAllowed = (lastPushAt: number | null, now: number): boolean =>
  lastPushAt === null || now - lastPushAt >= PUSH_GAP_MS

export const nicheAlertAllowed = (lastNicheAlertAt: number | null, now: number): boolean =>
  lastNicheAlertAt === null || now - lastNicheAlertAt >= NICHE_ALERT_GAP_MS

export interface PendingNotification {
  type: AlertType
  title: string
  url: string
}

/** Many alerts → one push: the first one's title and where it goes, plus "and N more". */
export function batchPush(pending: readonly PendingNotification[]): {
  title: string
  body: string
  url: string
} | null {
  const [first, ...rest] = pending
  if (!first) return null
  return {
    title: rest.length === 0 ? "subcult" : `subcult · ${pending.length} new`,
    body: rest.length === 0 ? first.title : `${first.title} · and ${rest.length} more`,
    url: rest.length === 0 ? first.url : "/notifications",
  }
}

export interface GrailSearch {
  brand: string
  /** What they're hunting: "leather jacket", "geobasket". */
  item: string
  maxPrice: number
  /** Optional size as written ("M", "48", "US 10"). */
  size: string | null
}

const words = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

/** "M" → matches "size M", "sz M", "(M)", " M " as its own token; "US 10" → "10". */
function sizeTokens(size: string): string[] {
  const tokens = words(size).filter((t) => !["us", "eu", "uk", "it", "size", "sz"].includes(t))
  return tokens.length > 0 ? tokens : words(size)
}

/**
 * Does a listing match the hunt? Brand and every item word in the title,
 * at or under the price, and the size as its own token when a size is set
 * (a listing that doesn't state the size isn't a match: we'd be guessing).
 */
export function matchesGrail(
  listing: { title: string; price: number; currency: string },
  search: GrailSearch,
): boolean {
  if (listing.currency !== "USD" || listing.price > search.maxPrice) return false
  const title = new Set(words(listing.title))
  const has = (text: string) => words(text).every((w) => title.has(w))
  if (!has(search.brand) || !has(search.item)) return false
  if (!search.size) return true
  return sizeTokens(search.size).every((t) => title.has(t))
}

/**
 * Only the browsers' own push services: the server POSTs to a subscription's
 * endpoint later, so anything else would let a client aim our requests at
 * arbitrary hosts.
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9.-]+\.push\.apple\.com$/,
  /^[a-z0-9.-]+\.notify\.windows\.com$/,
]

export function isPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && PUSH_HOSTS.some((host) => host.test(url.hostname))
  } catch {
    return false
  }
}
