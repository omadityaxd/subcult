import type { DeckCard, PairSide } from "./data"

/** A real piece of today's content from one niche, before it becomes a card. */
export interface LiveCandidate {
  niche: string
  kind: "fit" | "grail" | "pin" | "sound"
  id: string
  imageUrl: string
  /** What the picture actually is (brand, "seen on <artist>", track), shown small on the card. */
  label: string | null
  previewUrl?: string | null
  /** YouTube Shorts thumbnails are pillarboxed: crop to the video. */
  crop?: boolean
}

export interface PoolInput {
  /** The hand-made classic cards (multi-scene prompts). */
  classic: readonly DeckCard[]
  /** ~10 one-liners per niche. */
  lines: Readonly<Record<string, readonly string[]>>
  live: readonly LiveCandidate[]
  adjacent: (slug: string) => readonly string[]
  palette: (slug: string) => readonly string[]
  nicheImage: (slug: string) => string | null
}

const PAIRS = 3
const ADJACENT_WEIGHT = 1
const LEAD_WEIGHT = 3

/** When a niche's one-liners run out, the card asks plainly. */
const ASK: Record<LiveCandidate["kind"], string> = {
  fit: "Would you wear this?",
  grail: "Would you cop this?",
  pin: "This is your moodboard.",
  sound: "Is this your sound?",
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j] as T, out[i] as T]
  }
  return out
}

/**
 * Today's deck pool: every niche's one-liner card, live cards (real fits,
 * grails, pins, a sound preview) captioned with that niche's lines, "this
 * or that" pairs across scenes, and the classic cards. Shuffled per session
 * and with the lines rotating, so no two decks match.
 */
export function assemblePool(input: PoolInput, random: () => number): DeckCard[] {
  const decks = new Map(
    Object.entries(input.lines).map(([slug, lines]) => [slug, shuffle(lines, random)]),
  )
  const line = (slug: string) => decks.get(slug)?.shift() ?? null
  const weightsFor = (slug: string): Record<string, number> => ({
    ...Object.fromEntries(
      input
        .adjacent(slug)
        .slice(0, 2)
        .map((s) => [s, ADJACENT_WEIGHT]),
    ),
    [slug]: LEAD_WEIGHT,
  })
  const base = (slug: string, id: string) => ({
    palette: input.palette(slug),
    coverSeed: id,
    weights: weightsFor(slug),
  })

  const lineCards: DeckCard[] = Object.keys(input.lines).flatMap((slug) => {
    const prompt = line(slug)
    return prompt
      ? [
          {
            ...base(slug, `line-${slug}`),
            id: `line-${slug}`,
            kind: "line" as const,
            prompt,
            imageUrl: input.nicheImage(slug),
          },
        ]
      : []
  })

  // One live card per niche and kind, picked at random from what's there today.
  const byKey = new Map<string, LiveCandidate[]>()
  for (const candidate of shuffle(input.live, random)) {
    const key = `${candidate.niche}|${candidate.kind}`
    byKey.set(key, [...(byKey.get(key) ?? []), candidate])
  }
  const used = new Set<string>()
  const liveCards: DeckCard[] = [...byKey.values()].flatMap(([candidate]) => {
    if (!candidate) return []
    used.add(candidate.id)
    return [
      {
        ...base(candidate.niche, candidate.id),
        id: `live-${candidate.id}`,
        kind: candidate.kind,
        // A niche's lines describe its look ("Your sneaker shelf is a museum"): on a song they
        // read as a mismatch, so sound cards always ask plainly.
        prompt:
          candidate.kind === "sound"
            ? ASK.sound
            : (line(candidate.niche) ?? ASK[candidate.kind]),
        imageUrl: candidate.imageUrl,
        crop: candidate.crop ?? false,
        credit: candidate.label,
        previewUrl: candidate.previewUrl ?? null,
      },
    ]
  })

  // "This or that": two looks from different scenes.
  const looks = shuffle(
    input.live.filter((c) => (c.kind === "fit" || c.kind === "pin") && !used.has(c.id)),
    random,
  )
  const side = (c: LiveCandidate): PairSide => ({
    imageUrl: c.imageUrl,
    label: c.label,
    crop: c.crop ?? false,
    weights: weightsFor(c.niche),
  })
  const pairs: DeckCard[] = []
  const paired = new Set<string>()
  for (const a of looks) {
    if (pairs.length >= PAIRS) break
    if (paired.has(a.id)) continue
    const b = looks.find((c) => c.niche !== a.niche && !paired.has(c.id) && c.id !== a.id)
    if (!b) continue
    paired.add(a.id).add(b.id)
    pairs.push({
      id: `pair-${a.id}-${b.id}`,
      kind: "pair",
      prompt: "This or that?",
      imageUrl: a.imageUrl,
      palette: input.palette(a.niche),
      coverSeed: `pair-${a.id}`,
      weights: {},
      pair: { a: side(a), b: side(b) },
    })
  }

  return shuffle([...input.classic, ...lineCards, ...liveCards, ...pairs], random)
}
