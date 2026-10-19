import type { VoteChoice } from "@/db/schema"

export type VoteTally = Partial<Record<VoteChoice, number>>

export interface VoteSplit {
  total: number
  /** Share of the first option ("cop", or "a" in a poll), 0-100, rounded. */
  pct: number
}

/**
 * What can be voted on: listings, fits, tracks/releases, pins and fit
 * checks, or a poll of two of them. Never people: artist and profile ids
 * aren't on the list.
 */
const ITEM = String.raw`(?:ebay|fit|pin|unsplash|pexels|soundtrack|itunes|subcult:release|spotify:track|youtube:fit):[A-Za-z0-9:._|\-]{1,200}`
export const VOTE_TARGET = new RegExp(String.raw`^(?:${ITEM}|poll:${ITEM}\|${ITEM})$`)

/** "62% cop" from real counts; zero votes is a 0-total split, never a made-up number. */
export function splitOf(tally: VoteTally, first: "cop" | "a"): VoteSplit {
  const second = first === "cop" ? "drop" : "b"
  const yes = tally[first] ?? 0
  const total = yes + (tally[second] ?? 0)
  return { total, pct: total === 0 ? 0 : Math.round((yes / total) * 100) }
}
