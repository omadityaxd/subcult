import { isYouTubeThumb, videoFrameWidth } from "@/lib/images/youtube-crop"
import { dedupeMusic } from "@/lib/feed/dedupe-music"
import type { RisingScope } from "@/lib/rising/pick"
import type { CoverArt } from "./cover-art"
import type { FeedItem } from "@/lib/feed/types"

/**
 * Today is an Issue: each person's daily subculture magazine. Pure: the
 * server gathers candidates, this decides the cover, what makes each
 * section, and the back page. Sections run in magazine order, always:
 * The Tea, The Sound, The Fit, The Grail, The Scene, then one Cop or Drop.
 */

export const TODAY_MIN = 15
export const TODAY_MAX = 25

export const SECTION_IDS = ["tea", "sound", "fit", "grail", "scene"] as const
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
  /** No fit or grail cover: an artist portrait or a mosaic (set by the server). */
  art?: CoverArt | null
}

export interface TodayEdition {
  generatedAt: number
  mode: TodayMode
  /** Taste was too thin: trending + time of day, with a vibe check nudge. */
  cold: boolean
  cover: IssueCover
  sections: TodaySection[]
  /** One more fit or grail to vote on after The Scene (never one already in the issue). */
  copOrDrop: FeedItem | null
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
  soundPicks: FeedItem[]
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

export const newestFirst = (a: FeedItem, b: FeedItem) =>
  Date.parse(b.publishedAt ?? "0") - Date.parse(a.publishedAt ?? "0")

const withImage = (item: FeedItem) => Boolean(item.imageUrl)

/** Without measured sizes, a YouTube thumbnail (480px, black bars) is the one known-blurry cover. */
const notThumbnail = (item: FeedItem) => !isYouTubeThumb(item.imageUrl)

/**
 * Cover image: a real fit first, then a grail, then the lead story's image.
 * Never music, never below cover quality (the server passes a ≥1200px
 * check): with no sharp image the cover is the niche's generative one.
 */
export function pickCover(
  c: Candidates,
  sharpEnough: (item: FeedItem) => boolean = notThumbnail,
): FeedItem | null {
  return (
    [...c.fits, ...c.archive, ...c.digest, ...c.headlines].find(
      (item) => coverWorthy(item) && sharpEnough(item),
    ) ?? null
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
  return (
    withImage(item) &&
    item.meta.imageFallback !== true &&
    !isGossip(item) &&
    item.meta.heavy !== true
  )
}

const COVER_LINES = 3

/**
 * Three cover lines: the lead story, the newest drop, what's rising. A day
 * missing one tops up from real content (a track from The Sound, then more
 * stories), never an invented line.
 */
function coverLines(c: Candidates, cover: FeedItem | null): string[] {
  const stories = [...c.digest, ...c.headlines].filter(
    (item, i, all) =>
      item.id !== cover?.id &&
      !isGossip(item) &&
      item.meta.heavy !== true &&
      all.findIndex((other) => other.id === item.id) === i,
  )
  const drop = [...c.drops].sort(newestFirst)[0]
  const rising = c.rising[0]
  const lines = [
    stories[0]?.title,
    drop ? `New: ${drop.title}${drop.subtitle ? ` from ${drop.subtitle}` : ""}` : undefined,
    rising ? `${rising.label} is up ${rising.ratio}× this week` : undefined,
  ].filter((line): line is string => Boolean(line))
  // Variety first: with no drop, a track from The Sound before a second story.
  const pick = drop ? undefined : c.soundPicks[0]
  const extra = [
    pick ? `On repeat: ${pick.title}${pick.subtitle ? ` by ${pick.subtitle}` : ""}` : undefined,
    ...stories.slice(1).map((item) => item.title),
  ].filter((line): line is string => Boolean(line))
  for (const line of extra) {
    if (lines.length >= COVER_LINES) break
    if (!lines.includes(line)) lines.push(line)
  }
  return lines
}

/** A hero this wide (measured) prints sharp at the hero tile's size. */
const HERO_WIDTH = 1200

/**
 * The Fit's first picture is its tall hero: the newest one that's at least
 * HERO_WIDTH wide leads, else the sharpest. The rest keep newest-first.
 */
function sharpestFirst(items: FeedItem[]): FeedItem[] {
  // Sharpness is the width that's actually picture (a Short's thumbnail is mostly side bars).
  const width = (item: FeedItem) =>
    videoFrameWidth({
      imageUrl: item.imageUrl,
      short: item.meta.short === true,
      width: typeof item.meta.imgW === "number" ? item.meta.imgW : 0,
    })
  const sharp = items.find((item) => width(item) >= HERO_WIDTH)
  const best =
    sharp ??
    items.reduce<FeedItem | undefined>((a, b) => (a && width(a) >= width(b) ? a : b), undefined)
  return best ? [best, ...items.filter((item) => item !== best)] : items
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
    coverOk,
  }: {
    now: number
    mode: TodayMode
    cold: boolean
    nicheName?: string | null
    /** Cover quality check (server: measured width ≥ the cover minimum). */
    coverOk?: (item: FeedItem) => boolean
  },
): TodayEdition {
  const coverItem = pickCover(candidates, coverOk)
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
  // The newest drop leads; taste-ranked picks from the reader's scenes follow, any time of day.
  const [newest, ...olderDrops] = [...candidates.drops].sort(newestFirst)
  push(
    "sound",
    take(
      dedupeMusic([...(newest ? [newest] : []), ...candidates.soundPicks, ...olderDrops]),
      SECTION_CAPS.sound,
    ),
  )
  push("fit", sharpestFirst(take([...candidates.fits].sort(newestFirst), SECTION_CAPS.fit)))
  push("grail", take(candidates.archive, SECTION_CAPS.grail))

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

  // Cop or Drop closes the issue: something new to judge, so it never repeats a page.
  const copOrDrop =
    [...candidates.fits, ...candidates.archive].find(
      (item) => item.imageUrl && !used.has(item.id),
    ) ?? null

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
    copOrDrop,
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
