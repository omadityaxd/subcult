import type { RisingScope } from "@/lib/rising/pick"
import type { FeedItem } from "@/lib/feed/types"

/**
 * Today is an Issue: each person's daily subculture magazine. Pure: the
 * server gathers candidates, this decides the cover, what makes each
 * section, and the back page. Sections run in magazine order, always:
 * The Tea, The Fit, The Grail, The Sound, The Scene.
 */

export const TODAY_MIN = 15
export const TODAY_MAX = 25

export const SECTION_IDS = ["tea", "fit", "grail", "sound", "scene"] as const
export type SectionId = (typeof SECTION_IDS)[number]

export type TodayMode = "morning" | "day" | "night" | "weekend"

export interface RisingChip {
  entity: string
  label: string
  /** Rate vs the usual: 2.4 = 2.4× the last month's daily rate. */
  ratio: number
  href: string
  /** From the counted events: "3 new headlines + 1 release this week". */
  reason?: string | null
  /** "nearby"/"everywhere": widened past the reader's niches to reach the minimum. */
  scope?: RisingScope
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

export interface IssueCover {
  /** The image of the day: a vision-tagged fit or a grail, else the lead story. Null = palette cover. */
  item: FeedItem | null
  headline: string
  /** The three biggest stories in the issue. */
  lines: string[]
  /** The lead niche's palette, for the cover when there's no image (set by the server). */
  palette?: readonly string[] | null
}

export interface TodayEdition {
  generatedAt: number
  mode: TodayMode
  /** Taste was too thin: trending + time of day, with a vibe check nudge. */
  cold: boolean
  cover: IssueCover
  sections: TodaySection[]
  /** "Watching tomorrow: …", only from real momentum (never an invented release). */
  backPage: { teaser: string | null }
  /** Items in the issue (chips count once each; the cover counts). */
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

export const SECTION_TITLES: Record<SectionId, string> = {
  tea: "The Tea",
  fit: "The Fit",
  grail: "The Grail",
  sound: "The Sound",
  scene: "The Scene",
}

/**
 * Per-section caps. With the cover they leave room for The Scene inside
 * TODAY_MAX. The Sound is capped hard: this is a magazine, not a playlist.
 */
export const SECTION_CAPS: Record<SectionId, number> = {
  tea: 6,
  fit: 5,
  grail: 4,
  sound: 5,
  scene: 6,
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

const withImage = (item: FeedItem) => Boolean(item.imageUrl)

/** Cover image: a real fit first, then a grail, then the lead story's image. Never music. */
export function pickCover(c: Candidates): FeedItem | null {
  return (
    c.fits.find(coverWorthy) ??
    c.archive.find(coverWorthy) ??
    [...c.digest, ...c.headlines].find(coverWorthy) ??
    null
  )
}

/**
 * Gossip about people's private lives and public spats: fine deeper in the
 * issue, never the cover or a cover line. A magazine leads with the culture.
 */
const GOSSIP =
  /\b(calls? out|slams?|claps? back|exposed?|exposes|beef|feud|dating|girlfriend|boyfriend|baby|pregnan\w*|cheat(?:ed|ing)?|leaked dms?|arrest(?:ed)?|lawsuit|sued|drama)\b/i

export const isGossip = (item: Pick<FeedItem, "title">): boolean => GOSSIP.test(item.title)

function coverWorthy(item: FeedItem): boolean {
  // A borrowed scene photo (tea-image.ts) isn't the story's own: never the cover.
  return withImage(item) && item.meta.imageFallback !== true && !isGossip(item)
}

function coverLines(c: Candidates, cover: FeedItem | null): string[] {
  const lead = [...c.digest, ...c.headlines].find(
    (item) => item.id !== cover?.id && !isGossip(item),
  )
  const drop = [...c.drops].sort(newestFirst)[0]
  const rising = c.rising[0]
  return [
    lead?.title,
    drop ? `New: ${drop.title}${drop.subtitle ? ` from ${drop.subtitle}` : ""}` : undefined,
    rising ? `${rising.label} is up ${rising.ratio}× this week` : undefined,
  ].filter((line): line is string => Boolean(line))
}

/**
 * Builds the issue: the cover, then the sections in magazine order, each
 * capped, nothing shown twice, at most TODAY_MAX items. Items arrive
 * pre-ranked by taste; ties keep that order.
 */
export function assembleEdition(
  candidates: Candidates,
  {
    now,
    mode,
    cold,
    nicheName = null,
  }: { now: number; mode: TodayMode; cold: boolean; nicheName?: string | null },
): TodayEdition {
  const coverItem = pickCover(candidates)
  const used = new Set<string>(coverItem ? [coverItem.id] : [])
  let count = coverItem ? 1 : 0
  const take = (pool: readonly FeedItem[], cap: number): FeedItem[] => {
    const out: FeedItem[] = []
    for (const item of pool) {
      if (out.length >= cap || count >= TODAY_MAX) break
      if (used.has(item.id)) continue
      used.add(item.id)
      out.push(item)
      count += 1
    }
    return out
  }
  const sections: TodaySection[] = []
  const push = (id: SectionId, items: FeedItem[], extra: Partial<TodaySection> = {}) => {
    if (items.length > 0 || extra.rising?.length || extra.friends?.length) {
      sections.push({ id, title: SECTION_TITLES[id], items, ...extra })
    }
  }
  push("tea", take([...candidates.digest, ...candidates.headlines], SECTION_CAPS.tea))
  push("fit", take([...candidates.fits].sort(newestFirst), SECTION_CAPS.fit))
  push("grail", take(candidates.archive, SECTION_CAPS.grail))
  const lateNight = mode === "night" || mode === "weekend" ? candidates.lateNight : []
  push(
    "sound",
    take([...[...candidates.drops].sort(newestFirst), ...lateNight], SECTION_CAPS.sound),
  )

  const rising = candidates.rising.slice(0, Math.min(SECTION_CAPS.scene, TODAY_MAX - count))
  count += rising.length
  const friends = candidates.friends.slice(0, Math.min(SECTION_CAPS.scene, TODAY_MAX - count))
  count += friends.length
  // A quiet day still gets a full issue: top up from the person's scenes, never past the minimum.
  const more: FeedItem[] = []
  for (const item of candidates.more) {
    if (count >= TODAY_MIN) break
    if (used.has(item.id) || item.type === "track") continue
    used.add(item.id)
    more.push(item)
    count += 1
  }
  push("scene", more, { rising, friends })

  const headline =
    coverItem?.title ?? (nicheName ? `Today in ${nicheName}` : "Today in your scenes")
  const watching =
    candidates.rising.find((chip) => chip.entity.startsWith("artist:")) ?? candidates.rising[0]
  return {
    generatedAt: now,
    mode,
    cold,
    cover: { item: coverItem, headline, lines: coverLines(candidates, coverItem).slice(0, 3) },
    sections,
    backPage: {
      teaser: watching
        ? `Watching tomorrow: ${watching.label} (${watching.ratio}× this week)`
        : null,
    },
    count,
  }
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
