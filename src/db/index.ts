import "server-only"
import { env } from "@/lib/env"
import { type Database, createDb } from "./create-db"

// Survive dev hot reloads without leaking a pool per reload.
const globalForDb = globalThis as unknown as { subcultDb?: ReturnType<typeof createDb> }

/** Returns null when DATABASE_URL is unset so callers can degrade gracefully. */
export function getDb(): Database | null {
  if (!env.DATABASE_URL) return null
  // One connection per serverless instance; the Supabase pooler does the fan-in.
  globalForDb.subcultDb ??= createDb(env.DATABASE_URL, { max: 1 })
  return globalForDb.subcultDb.db
}
