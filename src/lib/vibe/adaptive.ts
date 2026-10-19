import { type Answer, type ScoredCard, type Weights, rawScores } from "./score"

/** The deck never stops before this many cards… */
export const MIN_CARDS = 10
/** …and never runs past this many. */
export const MAX_CARDS = 16
/** The first few cards explore (cover as many scenes as possible) before narrowing. */
const EXPLORE_CARDS = 4
/** Front-runners the adaptive pick tries to separate. */
const CONTENDERS = 4
/** Confident = the leader has real support and the top 3 stand clear of 4th. */
const CONFIDENT_TOP = 6
const SEPARATION = 2
/**
 * Exploring: any card covering this much new ground is as good as another,
 * so a few many-scene classics can't open every deck.
 */
const NOVELTY_CAP = 6
const EXPLORE_JITTER = 3
/** Today's real content beats a prompt card when both explore equally well. */
const LIVE_KINDS = new Set(["fit", "grail", "pin", "sound", "pair"])
const LIVE_BONUS = 1
/** How much confirming the current leader is worth next to separating rivals. */
const CONFIRM = 0.5
/** Randomness per session: enough to vary the deck, never enough to beat a better card. */
const JITTER = 0.6

export interface AdaptiveCard extends ScoredCard {
  kind: string
}

const weightOf = (weights: Weights, slug: string) => weights[slug] ?? 0

/** Every niche a card can say something about. */
function touches(card: AdaptiveCard): string[] {
  return card.pair
    ? [...Object.keys(card.pair.a.weights), ...Object.keys(card.pair.b.weights)]
    : Object.keys(card.weights)
}

/** How well a card separates the contenders: a card everyone shares (or nobody) says nothing. */
function discrimination(card: AdaptiveCard, contenders: readonly string[]): number {
  if (card.pair) {
    const { a, b } = card.pair
    return contenders.reduce(
      (sum, slug) => sum + Math.abs(weightOf(a.weights, slug) - weightOf(b.weights, slug)),
      0,
    )
  }
  const values = contenders.map((slug) => weightOf(card.weights, slug))
  return Math.max(...values) - Math.min(...values) + (values.some((v) => v > 0) ? 0.5 : 0)
}

/** A card's weight on the leading scene (a pair counts the side that has it). */
function leaderWeight(card: AdaptiveCard, leader: string | undefined): number {
  if (!leader) return 0
  if (card.pair) {
    return Math.max(weightOf(card.pair.a.weights, leader), weightOf(card.pair.b.weights, leader))
  }
  return weightOf(card.weights, leader)
}

/** Weight on scenes no card has asked about yet. */
function novelty(card: AdaptiveCard, covered: ReadonlySet<string>): number {
  const all = card.pair ? { ...card.pair.a.weights, ...card.pair.b.weights } : card.weights
  return Object.entries(all).reduce((sum, [slug, w]) => sum + (covered.has(slug) ? 0 : w), 0)
}

/**
 * The next card, like 20 questions: explore first, then the card that best
 * separates the current front-runners. Null when the deck should stop.
 */
export function nextCard<T extends AdaptiveCard>(
  pool: readonly T[],
  history: readonly { id: string; answer: Answer }[],
  random: () => number,
): T | null {
  const answers = Object.fromEntries(history.map((h) => [h.id, h.answer]))
  if (isDone(pool, answers, history.length)) return null
  const unseen = pool.filter((card) => !(card.id in answers))
  if (unseen.length === 0) return null
  const lastKind = pool.find((card) => card.id === history.at(-1)?.id)?.kind
  const covered = new Set(
    pool.filter((card) => card.id in answers).flatMap((card) => touches(card)),
  )
  const scores = rawScores(pool, answers)
  // Front-runners: the best-scoring scenes, topped up with ones not yet ruled out (score ≥ 0),
  // so one clear favourite still gets tested against fresh rivals.
  const universe = new Set(pool.flatMap((card) => touches(card)))
  const contenders = [...universe]
    .map((slug) => [slug, scores.get(slug) ?? 0] as const)
    .filter(([, score]) => score >= 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, CONTENDERS)
    .map(([slug]) => slug)
  const exploring = history.length < EXPLORE_CARDS || contenders.length < 2

  let best: T | null = null
  let bestValue = -Infinity
  for (const card of unseen) {
    const value =
      (exploring
        ? Math.min(novelty(card, covered), NOVELTY_CAP) +
          (LIVE_KINDS.has(card.kind) ? LIVE_BONUS : 0) +
          random() * EXPLORE_JITTER
        : discrimination(card, contenders) + CONFIRM * leaderWeight(card, contenders[0])) +
      // Variety: don't serve the same kind of card twice in a row.
      (card.kind === lastKind ? -1 : 0) +
      random() * JITTER
    if (value > bestValue) {
      best = card
      bestValue = value
    }
  }
  return best
}

/** Whether the result is settled: the minimum is reached and the top 3 stand clear (or the cap). */
export function isDone(
  pool: readonly AdaptiveCard[],
  answers: Readonly<Record<string, Answer>>,
  count: number,
): boolean {
  if (count >= MAX_CARDS) return true
  if (count < MIN_CARDS) return false
  const [a = 0, , c = 0, d = 0] = [...rawScores(pool, answers).values()]
    .filter((score) => score > 0)
    .sort((x, y) => y - x)
  if (a < CONFIDENT_TOP) return false
  return c === 0 || c - d >= SEPARATION
}

/** Small seeded PRNG (mulberry32), so a session's randomness is reproducible in tests. */
export function seededRandom(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}
