/**
 * pnpm trends:upsert
 *
 * Publishes hand-researched trend files from data/trends/*.json (written by the
 * /refresh-trends Claude Code command) as trending niches. Validates every
 * file first; refuses overlaps with existing niches; never touches evergreen
 * niches. Safe to re-run.
 */
import { z } from "zod"
import { createDb } from "../src/db/create-db"
import { createTrendStore, upsertTrendingNiche } from "../src/db/trend-repository"
import { nicheProfileSchema } from "../src/lib/engine/profile-schema"
import { SEED_PROFILES } from "../src/lib/niches/catalog"
import { addDays } from "../src/lib/niches/lifecycle"
import { findOverlap } from "../src/lib/trends/overlap"
import { parseTrendSettings } from "../src/lib/trends/server"
import { readTrendFiles } from "../src/lib/trends/trend-file"
import { loadLocalEnv } from "./load-env"

async function main(): Promise<void> {
  loadLocalEnv()
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("Missing DATABASE_URL. Set it in .env.local first.")
    process.exitCode = 1
    return
  }

  const entries = readTrendFiles()
  const invalid = entries.filter((entry) => !entry.result.success)
  for (const { file, result } of invalid) {
    if (!result.success) console.error(`✗ ${file}\n${z.prettifyError(result.error)}`)
  }
  if (invalid.length > 0) {
    process.exitCode = 1
    return
  }
  if (entries.length === 0) {
    console.log("no files in data/trends — nothing to do")
    return
  }

  const { TREND_TTL_DAYS } = parseTrendSettings(process.env)
  const { db, close } = createDb(databaseUrl, { max: 1 })
  try {
    const dbNiches = await createTrendStore(db).listExisting()
    const now = new Date()
    for (const { file, result } of entries) {
      if (!result.success) continue
      const { trendScore, sources } = result.data
      // Strip the trend-only fields (whyNow etc.) back down to a plain profile.
      const profile = nicheProfileSchema.parse(result.data)
      // Existing trending rows may be updated; anything else that overlaps is refused.
      const others = [
        ...SEED_PROFILES.map(({ slug, name, relatedNiches }) => ({ slug, name, relatedNiches })),
        ...dbNiches.filter((niche) => niche.slug !== profile.slug),
      ]
      const overlap = findOverlap(profile, others)
      if (overlap) {
        console.log(`⊘ ${file}: ${overlap}`)
        continue
      }
      const outcome = await upsertTrendingNiche(db, {
        profile,
        sources,
        trendScore,
        model: "curated",
        inputTokens: 0,
        outputTokens: 0,
        publishedAt: now,
        expiresAt: addDays(now, TREND_TTL_DAYS),
      })
      console.log(`${outcome === "skipped" ? "⊘" : "✓"} ${profile.slug}: ${outcome}`)
    }
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
