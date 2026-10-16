/**
 * pnpm alerts:run [--probe]
 *
 * Runs the daily alerts job once (grail hunts, drops, niche momentum, one
 * batched push each) and prints the report. --probe adds a throwaway
 * grail hunt for a test user first, prints what it caught, then removes it.
 */
import { randomUUID } from "node:crypto"
import { loadLocalEnv } from "./load-env"

async function main(): Promise<void> {
  loadLocalEnv()
  const { getDb } = await import("../src/db")
  const { createAlertsRepository } = await import("../src/db/alerts-repository")
  const { runAlerts } = await import("../src/lib/alerts/run")
  const db = getDb()
  if (!db) throw new Error("DATABASE_URL not set")
  const repo = createAlertsRepository(db)
  const probeUser = process.argv.includes("--probe") ? randomUUID() : null
  if (probeUser) {
    await repo.addGrail(probeUser, {
      brandSlug: "rick-owens",
      brand: "Rick Owens",
      item: "jacket",
      maxPrice: 2000,
      size: null,
    })
  }
  try {
    console.log(JSON.stringify(await runAlerts(db, repo), null, 2))
    if (probeUser) {
      const caught = await repo.list(probeUser)
      console.log(`\nprobe hunt "Rick Owens jacket under $2000" caught ${caught.length}:`)
      for (const n of caught.slice(0, 5)) console.log(`  ${n.title} · ${n.body}`)
    }
  } finally {
    if (probeUser) {
      const { grailSearches, notifications, alertPrefs } = await import("../src/db/schema")
      const { eq } = await import("drizzle-orm")
      await db.delete(notifications).where(eq(notifications.userId, probeUser))
      await db.delete(grailSearches).where(eq(grailSearches.userId, probeUser))
      await db.delete(alertPrefs).where(eq(alertPrefs.userId, probeUser))
      console.log("probe removed")
    }
  }
  process.exit(0)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
