import { z } from "zod"
import { type EntityRef, entityType, isEntityRef } from "./entities"

/**
 * The taste model: implicit signals → a decaying affinity per entity. Pure
 * and explainable on purpose: every number traces back to things the person
 * did, and every personalized card can say which one.
 */

export const SIGNAL_KINDS = [
  "play",
  "play_through",
  "skip",
  "save",
  "like",
  "share",
  "dwell",
  "open",
  "not_my_vibe",
  "vibe_check",
  "follow",
] as const
export type SignalKind = (typeof SIGNAL_KINDS)[number]

/** How much one signal says about taste. Negative = "less of this". */
export const SIGNAL_WEIGHT: Record<SignalKind, number> = {
  play: 1,
  play_through: 2,
  skip: -1,
  save: 3,
  like: 2,
  share: 4,
  dwell: 0.5,
  open: 1,
  not_my_vibe: -5,
  vibe_check: 4,
  follow: 5,
}

export const HALF_LIFE_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

export const signalSchema = z.object({
  kind: z.enum(SIGNAL_KINDS),
  entity: z.string().refine(isEntityRef, "entity ref like artist:slug"),
  /** Display name at the time ("Nettspend"), so reasons never need the taxonomy. */
  label: z.string().min(1).max(80),
  /** Multiplier on the kind's weight (vibe check share, card's secondary entity). 0–1. */
  strength: z.number().min(0).max(1).default(1),
  at: z.number().int().positive(),
})
export type Signal = z.infer<typeof signalSchema> & { entity: EntityRef }

export interface Affinity {
  entity: EntityRef
  label: string
  score: number
  /** The strongest positive signal behind it: what "because you…" cites. */
  because: SignalKind | null
}

export type TasteVector = ReadonlyMap<EntityRef, Affinity>

export const decay = (ageMs: number, halfLifeDays = HALF_LIFE_DAYS): number =>
  Math.pow(0.5, Math.max(0, ageMs) / (halfLifeDays * DAY_MS))

/** Σ weight × strength × ½^(age / half-life), per entity. */
export function computeAffinity(
  signals: readonly Signal[],
  now: number,
  halfLifeDays = HALF_LIFE_DAYS,
): Map<EntityRef, Affinity> {
  const out = new Map<EntityRef, Affinity & { best: number }>()
  for (const signal of signals) {
    const contribution =
      SIGNAL_WEIGHT[signal.kind] * signal.strength * decay(now - signal.at, halfLifeDays)
    const current = out.get(signal.entity) ?? {
      entity: signal.entity,
      label: signal.label,
      score: 0,
      because: null,
      best: 0,
    }
    current.score += contribution
    current.label = signal.label
    if (contribution > current.best) {
      current.best = contribution
      current.because = signal.kind
    }
    out.set(signal.entity, current)
  }
  return new Map(
    [...out].map(([ref, { entity, label, score, because }]) => [
      ref,
      { entity, label, score, because },
    ]),
  )
}

/** Strongest positive entities first (the Taste page, cold-start checks, server requests). */
export function topEntities(
  vector: TasteVector,
  limit = 10,
  type?: ReturnType<typeof entityType>,
): Affinity[] {
  return [...vector.values()]
    .filter((a) => a.score > 0 && (!type || entityType(a.entity) === type))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** No meaningful taste yet: fall back to time-of-day + trending and nudge the vibe check. */
export const isColdStart = (vector: TasteVector): boolean =>
  topEntities(vector, 1).every((a) => a.score < 1)
