/**
 * pnpm db:status — read-only health check: niche counts by lifecycle,
 * usage ledger size, RLS flags and applied migrations.
 */
import { sql } from "drizzle-orm"
import { createDb } from "../src/db/create-db"
import { loadLocalEnv } from "./load-env"

async function main(): Promise<void> {
  loadLocalEnv()
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("Missing DATABASE_URL. Set it in .env.local first.")
    process.exitCode = 1
    return
  }

  const { db, close } = createDb(databaseUrl, { max: 1 })
  try {
    // Sequential on purpose: one pooled connection, and a health check isn't latency-sensitive.
    const byLifecycle = await db.execute<{
      kind: string
      status: string
      generated_by: string
      n: number
    }>(
      sql`select kind, status, generated_by, count(*)::int as n from niches group by 1, 2, 3 order by 1, 2, 3`,
    )
    const totals = await db.execute<{ niches: number; usage_rows: number }>(
      sql`select (select count(*)::int from niches) as niches, (select count(*)::int from llm_usage) as usage_rows`,
    )
    const rls = await db.execute<{ relname: string; relrowsecurity: boolean }>(
      sql`select relname, relrowsecurity from pg_class where relname in ('niches', 'llm_usage') order by relname`,
    )
    const migrations = await db.execute<{ applied: number }>(
      sql`select count(*)::int as applied from drizzle.__drizzle_migrations`,
    )

    console.log(`niches: ${totals[0].niches} rows · llm_usage: ${totals[0].usage_rows} rows`)
    for (const row of byLifecycle) {
      console.log(
        `  ${row.kind.padEnd(10)} ${row.status.padEnd(9)} by ${row.generated_by.padEnd(6)} ${row.n}`,
      )
    }
    console.log(
      `RLS: ${rls.map((r) => `${r.relname}=${r.relrowsecurity ? "on" : "OFF"}`).join(", ")}`,
    )
    console.log(`migrations applied: ${migrations[0].applied}`)
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
