import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

interface CreateDbOptions {
  /** Max pooled connections for this process. */
  max?: number
}

/**
 * `prepare: false` is required for Supabase's transaction pooler (port 6543),
 * which cannot hold prepared statements across pooled transactions.
 */
export function createDb(url: string, { max = 5 }: CreateDbOptions = {}) {
  const client = postgres(url, { prepare: false, max })
  return {
    db: drizzle({ client, schema }),
    close: () => client.end(),
  }
}

export type Database = ReturnType<typeof createDb>["db"]
