import { z } from "zod"
import { type NicheShare, topMix } from "@/lib/vibe/score"

/**
 * On-device listening + browsing history for Wrapped. Stored in localStorage
 * until accounts land (Phase 6 migrates it). Pure reducers, so the rules are
 * unit-tested and the storage layer stays dumb.
 */

const trackSchema = z.object({
  title: z.string(),
  artist: z.string(),
  artworkUrl: z.string().nullable(),
  seconds: z.number(),
})

export const wrappedDataSchema = z.object({
  version: z.literal(1),
  since: z.number(),
  /** UTC day → niche slug → seconds listened. */
  days: z.record(z.string(), z.record(z.string(), z.number())),
  artists: z.record(z.string(), z.number()),
  tracks: z.record(z.string(), trackSchema),
  /** Niche slug → visits and the first time you opened it. */
  niches: z.record(z.string(), z.object({ visits: z.number(), firstSeen: z.number() })),
})
export type WrappedData = z.infer<typeof wrappedDataSchema>

export interface ListenEvent {
  trackId: string
  title: string
  artist: string
  artworkUrl: string | null
  niche: string | null
}

const MAX_TRACKS = 300
const DAY_MS = 86_400_000
/** A visit counts as half a minute of attention when ranking niches. */
const VISIT_WEIGHT_S = 30
export const WEEK_DAYS = 7
export const ERA_DAYS = 30

export const dayKey = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

export function emptyWrapped(now: number): WrappedData {
  return { version: 1, since: now, days: {}, artists: {}, tracks: {}, niches: {} }
}

export function recordListen(
  data: WrappedData,
  event: ListenEvent,
  seconds: number,
  now: number,
): WrappedData {
  if (!(seconds > 0)) return data
  const day = dayKey(now)
  const niche = event.niche ?? "_none"
  const today = data.days[day] ?? {}
  const existing = data.tracks[event.trackId]
  let tracks: WrappedData["tracks"] = {
    ...data.tracks,
    [event.trackId]: {
      title: event.title,
      artist: event.artist,
      artworkUrl: event.artworkUrl,
      seconds: (existing?.seconds ?? 0) + seconds,
    },
  }
  const ids = Object.keys(tracks)
  if (ids.length > MAX_TRACKS) {
    // Drop the least-played tracks; totals per day/artist keep the history.
    const keep = ids.sort((a, b) => tracks[b].seconds - tracks[a].seconds).slice(0, MAX_TRACKS)
    tracks = Object.fromEntries(keep.map((id) => [id, tracks[id]]))
  }
  return {
    ...data,
    days: { ...data.days, [day]: { ...today, [niche]: (today[niche] ?? 0) + seconds } },
    artists: { ...data.artists, [event.artist]: (data.artists[event.artist] ?? 0) + seconds },
    tracks,
  }
}

export function recordVisit(data: WrappedData, slug: string, now: number): WrappedData {
  const existing = data.niches[slug]
  return {
    ...data,
    niches: {
      ...data.niches,
      [slug]: { visits: (existing?.visits ?? 0) + 1, firstSeen: existing?.firstSeen ?? now },
    },
  }
}

/** Seconds per niche over the last `days` days (today included). */
function nicheSeconds(data: WrappedData, now: number, days: number): Map<string, number> {
  const totals = new Map<string, number>()
  for (let offset = 0; offset < days; offset++) {
    const day = data.days[dayKey(now - offset * DAY_MS)] ?? {}
    for (const [slug, seconds] of Object.entries(day)) {
      if (slug !== "_none") totals.set(slug, (totals.get(slug) ?? 0) + seconds)
    }
  }
  return totals
}

function allTimeNicheSeconds(data: WrappedData): Map<string, number> {
  const totals = new Map<string, number>()
  for (const day of Object.values(data.days)) {
    for (const [slug, seconds] of Object.entries(day)) {
      if (slug !== "_none") totals.set(slug, (totals.get(slug) ?? 0) + seconds)
    }
  }
  return totals
}

export interface WrappedSummary {
  since: number
  minutesListened: number
  /** Ranked by listening + visits, as whole percentages summing to 100. */
  topNiches: NicheShare[]
  topArtists: { name: string; minutes: number }[]
  topTracks: { id: string; title: string; artist: string; artworkUrl: string | null }[]
  nichesDiscovered: number
  discovered: string[]
  /** The niche that defined your last month, if one clearly did. */
  era: { slug: string; share: number } | null
  /** This week's listening split ("this week you were 70% rage"). */
  week: NicheShare[]
  hasData: boolean
}

export function summarize(data: WrappedData, now: number): WrappedSummary {
  const listened = allTimeNicheSeconds(data)
  const attention = new Map(listened)
  for (const [slug, { visits }] of Object.entries(data.niches)) {
    attention.set(slug, (attention.get(slug) ?? 0) + visits * VISIT_WEIGHT_S)
  }
  const rank = (totals: Map<string, number>) =>
    [...totals]
      .filter(([, score]) => score > 0)
      .map(([slug, score]) => ({ slug, score }))
      .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug))

  const totalSeconds = Object.values(data.days)
    .flatMap((day) => Object.values(day))
    .reduce((sum, seconds) => sum + seconds, 0)

  const monthly = rank(nicheSeconds(data, now, ERA_DAYS))
  const monthTotal = monthly.reduce((sum, entry) => sum + entry.score, 0)
  const eraShare = monthly[0] && monthTotal > 0 ? monthly[0].score / monthTotal : 0

  const discovered = Object.entries(data.niches)
    .sort(([, a], [, b]) => a.firstSeen - b.firstSeen)
    .map(([slug]) => slug)

  return {
    since: data.since,
    minutesListened: Math.round(totalSeconds / 60),
    topNiches: topMix(rank(attention)),
    topArtists: Object.entries(data.artists)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, seconds]) => ({ name, minutes: Math.max(1, Math.round(seconds / 60)) })),
    topTracks: Object.entries(data.tracks)
      .sort(([, a], [, b]) => b.seconds - a.seconds)
      .slice(0, 5)
      .map(([id, track]) => ({
        id,
        title: track.title,
        artist: track.artist,
        artworkUrl: track.artworkUrl,
      })),
    nichesDiscovered: discovered.length,
    discovered,
    // An "era" needs a clear leader: at least 35% of the month's listening.
    era:
      monthly[0] && eraShare >= 0.35
        ? { slug: monthly[0].slug, share: Math.round(eraShare * 100) }
        : null,
    week: topMix(rank(nicheSeconds(data, now, WEEK_DAYS))),
    hasData: totalSeconds > 0 || discovered.length > 0,
  }
}
