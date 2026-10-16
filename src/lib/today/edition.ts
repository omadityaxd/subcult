import type { FeedItem } from "@/lib/feed/types"

/**
 * Today: a finite, personal daily edition. Pure: the server gathers
 * candidates, this decides what makes the cut, in what order, for this
 * person's local time.
 */

export const TODAY_MIN = 15
export const TODAY_MAX = 25

export const SECTION_IDS = [
  "digest",
  "late-night",
  "drops",
  "headlines",
  "rising",
  "archive",
  "fits",
  "friends",
  "more",
] as const
export type SectionId = (typeof SECTION_IDS)[number]

export type TodayMode = "morning" | "day" | "night" | "weekend"

export interface RisingChip {
  entity: string
  label: string
  /** Rate vs the usual: 2.4 = 2.4× the last month's daily rate. */
  ratio: number
  href: string
}

export interface FriendChip {
  entity: string
  label: string
  /** Friends into it, by handle. */
  handles: string[]
  href: string
}

export interface TodaySection {
  id: SectionId
  title: string
  items: FeedItem[]
  rising?: RisingChip[]
  friends?: FriendChip[]
}

export interface TodayEdition {
  generatedAt: number
  mode: TodayMode
  /** Taste was too thin: trending + time of day, with a vibe check nudge. */
  cold: boolean
  sections: TodaySection[]
  /** Items in the edition (chips count once each). */
  count: number
}

/** Local clock for an IANA zone (falls back to UTC for anything invalid). */
export function localClock(now: number, timeZone: string): { hour: number; weekday: number } {
  let zone = "UTC"
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(now)
    zone = timeZone
  } catch {
    // Unknown zone: UTC.
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(now)
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0)
  const day = parts.find((p) => p.type === "weekday")?.value ?? "Mon"
  return { hour, weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(day) }
}

/** Night wins (late is late), then weekend, then morning, else day. */
export function todayMode({ hour, weekday }: { hour: number; weekday: number }): TodayMode {
  if (hour >= 22 || hour < 5) return "night"
  if (weekday === 0 || weekday === 6) return "weekend"
  return hour < 11 ? "morning" : "day"
}

/** Section order by moment: morning reads first, nights listen first, weekends shop and look. */
export const SECTION_ORDER: Record<TodayMode, readonly SectionId[]> = {
  morning: ["digest", "drops", "headlines", "friends", "rising", "fits", "archive"],
  day: ["drops", "headlines", "friends", "rising", "fits", "archive", "digest"],
  night: ["late-night", "drops", "friends", "rising", "fits", "headlines", "archive"],
  weekend: ["fits", "archive", "friends", "drops", "rising", "headlines", "late-night"],
}

const TITLES: Record<SectionId, string> = {
  digest: "Today in the underground",
  "late-night": "Late night rotation",
  drops: "New drops",
  headlines: "Fresh tea",
  rising: "What's rising in your niches",
  archive: "Just listed",
  fits: "New fits",
  friends: "Your friends are into this week",
  more: "More from your scenes",
}

/** Per-section caps, so no one kind floods a 25-item edition. */
const CAPS: Record<SectionId, number> = {
  digest: 3,
  "late-night": 6,
  drops: 6,
  headlines: 6,
  rising: 6,
  archive: 6,
  fits: 6,
  friends: 6,
  more: TODAY_MIN,
}

export interface Candidates {
  digest: FeedItem[]
  lateNight: FeedItem[]
  drops: FeedItem[]
  headlines: FeedItem[]
  archive: FeedItem[]
  fits: FeedItem[]
  rising: RisingChip[]
  /** Signed-in only: what people you follow are into this week. */
  friends: FriendChip[]
  /** The best of the person's niches right now: tops up a quiet day to TODAY_MIN. */
  more: FeedItem[]
}

const newestFirst = (a: FeedItem, b: FeedItem) =>
  Date.parse(b.publishedAt ?? "0") - Date.parse(a.publishedAt ?? "0")

/**
 * Builds the edition: sections in the moment's order, each capped, nothing
 * shown twice, at most TODAY_MAX items. Items are expected pre-ranked by
 * the caller (taste first); within a section, ties keep that order.
 */
export function assembleEdition(
  candidates: Candidates,
  { now, mode, cold }: { now: number; mode: TodayMode; cold: boolean },
): TodayEdition {
  const pools: Record<SectionId, FeedItem[]> = {
    digest: candidates.digest,
    "late-night": mode === "night" || mode === "weekend" ? candidates.lateNight : [],
    drops: [...candidates.drops].sort(newestFirst),
    headlines: candidates.headlines,
    rising: [],
    archive: candidates.archive,
    fits: [...candidates.fits].sort(newestFirst),
    friends: [],
    more: [],
  }
  const used = new Set<string>()
  let count = 0
  const sections: TodaySection[] = []
  for (const id of SECTION_ORDER[mode]) {
    if (count >= TODAY_MAX) break
    if (id === "rising") {
      const chips = candidates.rising.slice(0, Math.min(CAPS.rising, TODAY_MAX - count))
      if (chips.length > 0) {
        sections.push({ id, title: TITLES[id], items: [], rising: chips })
        count += chips.length
      }
      continue
    }
    if (id === "friends") {
      const chips = candidates.friends.slice(0, Math.min(CAPS.friends, TODAY_MAX - count))
      if (chips.length > 0) {
        sections.push({ id, title: TITLES[id], items: [], friends: chips })
        count += chips.length
      }
      continue
    }
    const items: FeedItem[] = []
    for (const item of pools[id]) {
      if (items.length >= CAPS[id] || count >= TODAY_MAX) break
      if (used.has(item.id)) continue
      used.add(item.id)
      items.push(item)
      count += 1
    }
    if (items.length > 0) sections.push({ id, title: TITLES[id], items })
  }
  // A quiet day still gets a full edition: top up from the person's scenes, never past the minimum.
  const more: FeedItem[] = []
  for (const item of candidates.more) {
    if (count >= TODAY_MIN) break
    if (used.has(item.id)) continue
    used.add(item.id)
    more.push(item)
    count += 1
  }
  if (more.length > 0) sections.push({ id: "more", title: TITLES.more, items: more })
  return { generatedAt: now, mode, cold, sections, count }
}

/** "since you were here Tuesday" / "yesterday" / "earlier today", in the person's zone. */
export function sinceLabel(lastVisit: number, now: number, timeZone: string): string {
  const day = (ms: number) => {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short" }).format(ms)
    } catch {
      return new Date(ms).toISOString().slice(0, 10)
    }
  }
  const days = Math.round((Date.parse(day(now)) - Date.parse(day(lastVisit))) / 86_400_000)
  if (days <= 0) return "since earlier today"
  if (days === 1) return "since you were here yesterday"
  if (days < 7) {
    let weekday = "a few days ago"
    try {
      weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(lastVisit)
    } catch {
      // keep the generic phrasing
    }
    return `since you were here ${weekday}`
  }
  return "since your last visit"
}
