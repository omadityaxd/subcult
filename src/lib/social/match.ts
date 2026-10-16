import { type EntityRef, entityType } from "@/lib/taste/entities"
import type { Affinity, TasteVector } from "@/lib/taste/model"

/**
 * Vibe Match: how close two people's taste is, from their affinity vectors.
 * Explainable: the percent comes with what they share and one thing from
 * the other person's taste you haven't touched yet.
 */

export interface VibeMatch {
  /** 0–100. */
  percent: number
  sharedNiches: { ref: EntityRef; label: string }[]
  sharedArtists: { ref: EntityRef; label: string }[]
  sharedBrands: { ref: EntityRef; label: string }[]
  /** Their strongest entity you've never interacted with. */
  putYouOn: { ref: EntityRef; label: string } | null
}

const SHARED_SHOWN = 5

const positive = (vector: TasteVector): Map<EntityRef, Affinity> =>
  new Map([...vector].filter(([, a]) => a.score > 0))

/**
 * Cosine similarity of the two positive-taste vectors, mapped to a percent
 * with a square root: taste vectors are sparse, so raw cosines between
 * people who clearly overlap sit around 0.3-0.6, which reads as "no match".
 * The root keeps 0 → 0% and 1 → 100% and stays monotonic.
 */
export function matchPercent(a: TasteVector, b: TasteVector): number {
  const pa = positive(a)
  const pb = positive(b)
  let dot = 0
  for (const [ref, affinity] of pa) dot += affinity.score * (pb.get(ref)?.score ?? 0)
  const norm = (v: Map<EntityRef, Affinity>) =>
    Math.sqrt([...v.values()].reduce((sum, x) => sum + x.score * x.score, 0))
  const denominator = norm(pa) * norm(pb)
  if (denominator === 0) return 0
  return Math.round(Math.sqrt(dot / denominator) * 100)
}

export function vibeMatch(me: TasteVector, them: TasteVector): VibeMatch {
  const mine = positive(me)
  const theirs = [...positive(them).values()].sort((x, y) => y.score - x.score)
  const shared = theirs
    .filter((a) => mine.has(a.entity))
    .sort(
      (x, y) =>
        (mine.get(y.entity)?.score ?? 0) * y.score - (mine.get(x.entity)?.score ?? 0) * x.score,
    )
  const of = (type: ReturnType<typeof entityType>) =>
    shared
      .filter((a) => entityType(a.entity) === type)
      .slice(0, SHARED_SHOWN)
      .map((a) => ({ ref: a.entity, label: a.label }))
  // "Never touched": no signal at all on your side, not even a skip.
  const fresh = theirs.find(
    (a) =>
      !me.has(a.entity) && (entityType(a.entity) === "artist" || entityType(a.entity) === "brand"),
  )
  return {
    percent: matchPercent(me, them),
    sharedNiches: of("niche"),
    sharedArtists: of("artist"),
    sharedBrands: of("brand"),
    putYouOn: fresh ? { ref: fresh.entity, label: fresh.label } : null,
  }
}
