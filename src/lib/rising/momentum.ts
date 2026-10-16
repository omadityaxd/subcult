import type { EntityRef } from "@/lib/taste/entities"

/**
 * Rising: real trend detection from dated events (headlines, releases,
 * uploads, and saves/plays inside subcult). An entity is rising when its
 * daily rate over the last 7 days beats its rate over the 28 days before.
 */

export const EVENT_SOURCES = ["headline", "release", "upload", "save", "play"] as const
export type EventSource = (typeof EVENT_SOURCES)[number]

/** A release is rarer and bigger news than a headline; in-app saves are strong intent. */
export const SOURCE_WEIGHT: Record<EventSource, number> = {
  headline: 1,
  release: 3,
  upload: 1,
  save: 2,
  play: 0.5,
}

export interface EntityEvent {
  entity: EntityRef
  label: string
  /** The niche the event was found through (for "rising in your niches"). */
  niche: string
  source: EventSource
  at: number
}

export interface Momentum {
  entity: EntityRef
  label: string
  niches: string[]
  /** Weighted events, last 7 days / days 8–35. */
  last7: number
  prior28: number
  /** Rate ratio, smoothed. 1 = steady, 3 = three times the usual rate. */
  ratio: number
  /** ratio's log2 × √volume: rising AND not a one-off. */
  score: number
}

const DAY_MS = 24 * 3600_000
export const RECENT_DAYS = 7
export const BASELINE_DAYS = 28
/** Smoothing (events/day) so one headline after silence isn't "∞× rising". */
const PRIOR_RATE = 0.25
/** Fewer weighted events than this in the last week isn't a trend. */
export const MIN_RECENT = 3
/** Rising means at least 1.5× the usual rate. */
export const MIN_RATIO = 1.5

export function computeMomentum(events: readonly EntityEvent[], now: number): Momentum[] {
  const byEntity = new Map<
    EntityRef,
    { label: string; niches: Set<string>; last7: number; prior28: number }
  >()
  for (const event of events) {
    const age = now - event.at
    if (age < 0 || age > (RECENT_DAYS + BASELINE_DAYS) * DAY_MS) continue
    const weight = SOURCE_WEIGHT[event.source]
    const entry = byEntity.get(event.entity) ?? {
      label: event.label,
      niches: new Set<string>(),
      last7: 0,
      prior28: 0,
    }
    entry.niches.add(event.niche)
    if (age <= RECENT_DAYS * DAY_MS) entry.last7 += weight
    else entry.prior28 += weight
    byEntity.set(event.entity, entry)
  }
  return [...byEntity].map(([entity, e]) => {
    const ratio = (e.last7 / RECENT_DAYS + PRIOR_RATE) / (e.prior28 / BASELINE_DAYS + PRIOR_RATE)
    return {
      entity,
      label: e.label,
      niches: [...e.niches].sort(),
      last7: e.last7,
      prior28: e.prior28,
      ratio,
      score: Math.log2(ratio) * Math.sqrt(e.last7),
    }
  })
}

/** Entities that are actually rising, strongest first. */
export function rising(events: readonly EntityEvent[], now: number, limit = 50): Momentum[] {
  return computeMomentum(events, now)
    .filter((m) => m.last7 >= MIN_RECENT && m.ratio >= MIN_RATIO)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** Dated mentions of entities in a list of titles (headlines, video titles). */
export function mentions<T extends { title: string; at: number | null }>(
  items: readonly T[],
  entities: readonly { ref: EntityRef; label: string; match: (title: string) => boolean }[],
  niche: string,
  source: EventSource,
): EntityEvent[] {
  return items.flatMap((item) =>
    item.at === null
      ? []
      : entities
          .filter((entity) => entity.match(item.title))
          .map((entity) => ({
            entity: entity.ref,
            label: entity.label,
            niche,
            source,
            at: item.at as number,
          })),
  )
}
