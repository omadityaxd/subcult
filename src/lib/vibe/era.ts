import type { NicheShare } from "./score"

/** Smaller moves than this between two checks aren't a shift, just noise. */
const SHIFT_POINTS = 5

/**
 * What changed since the last vibe check: a new top niche, or the biggest
 * move in the mix. Null on a first check.
 */
export function eraShift(
  previous: readonly NicheShare[] | null,
  current: readonly NicheShare[],
  nameOf: (slug: string) => string,
): string | null {
  const [before] = previous ?? []
  const [now] = current
  if (!previous || !before || !now) return null
  if (before.slug !== now.slug) {
    return `Your era shifted: ${nameOf(before.slug)} → ${nameOf(now.slug)}.`
  }
  const percentOf = (mix: readonly NicheShare[], slug: string) =>
    mix.find((entry) => entry.slug === slug)?.percent ?? 0
  const slugs = new Set([...previous, ...current].map((entry) => entry.slug))
  const moves = [...slugs]
    .map((slug) => ({ slug, delta: percentOf(current, slug) - percentOf(previous, slug) }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  const [biggest] = moves
  if (!biggest || Math.abs(biggest.delta) < SHIFT_POINTS) {
    return `Same era as last time: still ${nameOf(now.slug)}.`
  }
  const direction = biggest.delta > 0 ? "up" : "down"
  return `Your era shifted: ${nameOf(biggest.slug)} is ${direction} ${Math.abs(biggest.delta)} points since last time.`
}

/** Eras move fast: the issue asks for a re-check once the last one is a week old. */
export const RECHECK_DAYS = 7

export function recheckDue(takenAt: number | null, now: number): boolean {
  return takenAt === null || now - takenAt >= RECHECK_DAYS * 24 * 3600_000
}
