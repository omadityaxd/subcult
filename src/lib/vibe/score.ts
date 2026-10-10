import { z } from "zod"

/** Swipe right = that's me, left = not me, skip = no opinion. */
export type Answer = "like" | "pass" | "skip"

export const vibeCardSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  prompt: z.string().min(8).max(80),
  image: z.object({
    kind: z.enum(["artist", "niche"]),
    slug: z.string().regex(/^[a-z0-9-]+$/),
  }),
  /** Niche slug → how strongly a "that's me" points at it (1–3). */
  weights: z.record(z.string(), z.number().int().min(1).max(3)),
})
export type VibeCard = z.infer<typeof vibeCardSchema>

export interface NicheShare {
  slug: string
  percent: number
}

/** A pass pulls a niche down a little; it shouldn't erase a strong like. */
const PASS_PENALTY = 0.3
export const MIX_SIZE = 3

/** Net score per niche from the answers (only positive scores survive). */
export function scoreVibe(
  cards: readonly Pick<VibeCard, "id" | "weights">[],
  answers: Readonly<Record<string, Answer>>,
): { slug: string; score: number }[] {
  const scores = new Map<string, number>()
  for (const card of cards) {
    const answer = answers[card.id]
    if (!answer || answer === "skip") continue
    const sign = answer === "like" ? 1 : -PASS_PENALTY
    for (const [slug, weight] of Object.entries(card.weights)) {
      scores.set(slug, (scores.get(slug) ?? 0) + sign * weight)
    }
  }
  return [...scores]
    .filter(([, score]) => score > 0)
    .map(([slug, score]) => ({ slug, score }))
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug))
}

/**
 * Top niches as whole percentages that always add up to exactly 100
 * (largest-remainder rounding). Empty when nothing scored positive.
 */
export function topMix(
  scores: readonly { slug: string; score: number }[],
  size = MIX_SIZE,
): NicheShare[] {
  const top = scores.slice(0, size)
  const total = top.reduce((sum, entry) => sum + entry.score, 0)
  if (total <= 0) return []
  const exact = top.map((entry) => ({ slug: entry.slug, raw: (entry.score / total) * 100 }))
  const floored = exact.map((entry) => ({ ...entry, percent: Math.floor(entry.raw) }))
  let left = 100 - floored.reduce((sum, entry) => sum + entry.percent, 0)
  const byRemainder = [...floored].sort(
    (a, b) => b.raw - Math.floor(b.raw) - (a.raw - Math.floor(a.raw)),
  )
  const bonus = new Set<string>()
  for (const entry of byRemainder) {
    if (left <= 0) break
    bonus.add(entry.slug)
    left -= 1
  }
  return floored
    .map(({ slug, percent }) => ({ slug, percent: percent + (bonus.has(slug) ? 1 : 0) }))
    .sort((a, b) => b.percent - a.percent)
}

/** Share URL segment: "rage.47_vamp.31_plugg.22". */
export function encodeMix(mix: readonly NicheShare[]): string {
  return mix.map((entry) => `${entry.slug}.${entry.percent}`).join("_")
}

/** Parses a share segment; null unless it's 1–3 known niches summing to 100. */
export function decodeMix(
  segment: string,
  isNiche: (slug: string) => boolean,
): NicheShare[] | null {
  const parts = segment.split("_")
  if (parts.length < 1 || parts.length > MIX_SIZE) return null
  const mix: NicheShare[] = []
  for (const part of parts) {
    const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.(\d{1,3})$/.exec(part)
    if (!match || !isNiche(match[1])) return null
    mix.push({ slug: match[1], percent: Number(match[2]) })
  }
  const total = mix.reduce((sum, entry) => sum + entry.percent, 0)
  const unique = new Set(mix.map((entry) => entry.slug)).size === mix.length
  return total === 100 && unique ? mix : null
}

export const blurbsSchema = z.object({
  niches: z.record(z.string(), z.string().min(10).max(160)),
  combos: z.array(
    z.object({ pair: z.tuple([z.string(), z.string()]), text: z.string().min(10).max(160) }),
  ),
  /** "branchA+branchB" (or "branch+any") → template with {a} and {b}. */
  branchCombos: z.record(z.string(), z.string()),
  fallback: z.string(),
})
export type Blurbs = z.infer<typeof blurbsSchema>

/**
 * Zero-cost result copy: the top niche's line, then a combo line for the top
 * two (a hand-written pairing, a branch-level template, or the fallback).
 */
export function templateBlurb(
  mix: readonly NicheShare[],
  blurbs: Blurbs,
  {
    nameOf,
    branchOf,
  }: { nameOf: (slug: string) => string; branchOf: (slug: string) => string | undefined },
): string {
  const [first, second] = mix
  if (!first) return ""
  const lead = blurbs.niches[first.slug] ?? `${nameOf(first.slug)} runs your whole personality.`
  if (!second) return lead
  const pair = blurbs.combos.find(
    ({ pair: [x, y] }) =>
      (x === first.slug && y === second.slug) || (x === second.slug && y === first.slug),
  )
  const branchA = branchOf(first.slug)
  const branchB = branchOf(second.slug)
  const template =
    pair?.text ??
    (branchA && branchB ? blurbs.branchCombos[`${branchA}+${branchB}`] : undefined) ??
    (branchA ? blurbs.branchCombos[`${branchA}+any`] : undefined) ??
    blurbs.fallback
  const combo = template
    .replaceAll("{a}", nameOf(first.slug))
    .replaceAll("{b}", nameOf(second.slug))
  return `${lead} ${combo}`
}
