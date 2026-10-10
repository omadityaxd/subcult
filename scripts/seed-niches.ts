/**
 * pnpm seed:niches
 *
 * Upserts the curated profiles in /data/niches into Postgres. Idempotent:
 * new slugs are inserted, changed seed files update their row, everything
 * else is left alone. No LLM involved (see `pnpm generate:niche` for that).
 */
import { createDb } from "../src/db/create-db"
import { upsertSeedProfiles } from "../src/db/niche-repository"
import { SEED_PROFILES } from "../src/lib/niches/catalog"
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
    const result = await upsertSeedProfiles(db, SEED_PROFILES)
    for (const slug of result.inserted) console.log(`+ ${slug}`)
    for (const slug of result.updated) console.log(`~ ${slug}`)
    console.log(
      `\n${SEED_PROFILES.length} seed files: ${result.inserted.length} inserted, ${result.updated.length} updated, ${result.unchanged} unchanged`,
    )
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
