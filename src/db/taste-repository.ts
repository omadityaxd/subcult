import { and, desc, eq, gte } from "drizzle-orm"
import type { Signal } from "../lib/taste/model"
import { isEntityRef } from "../lib/taste/entities"
import type { Database } from "./create-db"
import { tasteSignals } from "./schema"

/** Signals older than this no longer move the vector (≈4 half-lives). */
const WINDOW_MS = 60 * 24 * 3600_000
export const MAX_SIGNALS_RETURNED = 3000

export interface TasteRepository {
  /** Inserts new signals; ones already stored (same kind, entity, time) are skipped. */
  add(userId: string, signals: readonly Signal[]): Promise<void>
  recent(userId: string, now?: number): Promise<Signal[]>
  reset(userId: string): Promise<void>
}

export function createTasteRepository(db: Database): TasteRepository {
  return {
    async add(userId, signals) {
      if (signals.length === 0) return
      await db
        .insert(tasteSignals)
        .values(signals.map((s) => ({ userId, ...s })))
        .onConflictDoNothing()
    },

    async recent(userId, now = Date.now()) {
      const rows = await db
        .select()
        .from(tasteSignals)
        .where(and(eq(tasteSignals.userId, userId), gte(tasteSignals.at, now - WINDOW_MS)))
        .orderBy(desc(tasteSignals.at))
        .limit(MAX_SIGNALS_RETURNED)
      return rows.flatMap((row): Signal[] =>
        isEntityRef(row.entity)
          ? [
              {
                kind: row.kind,
                entity: row.entity,
                label: row.label,
                strength: row.strength,
                at: row.at,
              },
            ]
          : [],
      )
    },

    async reset(userId) {
      await db.delete(tasteSignals).where(eq(tasteSignals.userId, userId))
    },
  }
}
