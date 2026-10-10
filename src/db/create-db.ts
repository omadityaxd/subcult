import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

interface CreateDbOptions {
  /** Max pooled connections for this process. */
  max?: number
}

/** Fail fast instead of hanging a request or script on an unreachable database. */
const CONNECT_TIMEOUT_S = 10
/** Bound shutdown: end() otherwise waits indefinitely on pooled connections. */
const END_TIMEOUT_S = 5

/**
 * `prepare: false` is required for Supabase's transaction pooler (port 6543),
 * which cannot hold prepared statements across pooled transactions.
 */
export function createDb(url: string, { max = 5 }: CreateDbOptions = {}) {
  const client = postgres(url, { prepare: false, max, connect_timeout: CONNECT_TIMEOUT_S })
  return {
    db: drizzle({ client, schema }),
    close: () => client.end({ timeout: END_TIMEOUT_S }),
  }
}

export type Database = ReturnType<typeof createDb>["db"]
