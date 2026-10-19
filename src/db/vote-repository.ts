import { inArray, sql } from "drizzle-orm"
import type { Database } from "./create-db"
import { type VoteChoice, votes } from "./schema"
import type { VoteTally } from "@/lib/votes/split"

/** One vote per voter per item; voting again changes it. */
export async function castVote(
  db: Database,
  vote: { targetId: string; voter: string; choice: VoteChoice },
): Promise<void> {
  await db
    .insert(votes)
    .values(vote)
    .onConflictDoUpdate({
      target: [votes.targetId, votes.voter],
      set: { choice: vote.choice, createdAt: sql`now()` },
    })
}

/** Counts per choice for each item. */
export async function tallies(
  db: Database,
  targetIds: readonly string[],
): Promise<Map<string, VoteTally>> {
  const out = new Map<string, VoteTally>()
  if (targetIds.length === 0) return out
  const rows = await db
    .select({ targetId: votes.targetId, choice: votes.choice, n: sql<number>`count(*)::int` })
    .from(votes)
    .where(inArray(votes.targetId, [...targetIds]))
    .groupBy(votes.targetId, votes.choice)
  for (const row of rows) {
    out.set(row.targetId, { ...out.get(row.targetId), [row.choice]: row.n })
  }
  return out
}
