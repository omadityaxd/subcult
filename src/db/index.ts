import "server-only"
import { env } from "@/lib/env"
import { type Database, createDb } from "./create-db"

// Survive dev hot reloads without leaking a pool per reload.
const globalForDb = globalThis as unknown as { subcultDb?: ReturnType<typeof createDb> }

/**
 * Connections per instance. Not 1: postgres.js pipelines queries that exceed
 * the pool, and a burst of ~5 pipelined queries on a *cold* connection hangs
 * behind Supabase's transaction pooler (reproduced Oct 2026). 3 gives parallel
 * reads (e.g. /admin/usage's 5-query summary) real connections; the pooler
 * still does the fan-in.
 */
const POOL_SIZE = 3

/** Returns null when DATABASE_URL is unset so callers can degrade gracefully. */
export function getDb(): Database | null {
  if (!env.DATABASE_URL) return null
  globalForDb.subcultDb ??= createDb(env.DATABASE_URL, { max: POOL_SIZE })
  return globalForDb.subcultDb.db
}
