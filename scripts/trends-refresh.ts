/**
 * pnpm trends:refresh [--dry-run]
 *
 * Runs the trend engine once: archive expired trends, gather signals (Google
 * News RSS, YouTube, optional Claude web search), propose ≤3 new niches with
 * ≥3 cited sources each, generate + publish them, refresh stale trends.
 * Capped by TREND_RUN_MAX_COST_USD. --dry-run gathers signals only: no LLM
 * calls, no writes.
 */
import { createDb } from "../src/db/create-db"
import { formatUsd } from "../src/lib/engine/pricing"
import { log } from "../src/lib/log"
import { runTrendRefresh } from "../src/lib/trends/refresh"
import { createTrendDeps, parseTrendSettings } from "../src/lib/trends/server"
import { loadLocalEnv } from "./load-env"

async function main(): Promise<void> {
  loadLocalEnv()
  const dryRun = process.argv.includes("--dry-run")
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("Missing DATABASE_URL. Set it in .env.local first.")
    process.exitCode = 1
    return
  }

  const settings = parseTrendSettings(process.env)
  const { db, close } = createDb(databaseUrl, { max: 3 })
  try {
    const deps = await createTrendDeps(db, settings, log)
    const existing = [...deps.seeds, ...(await deps.store.listExisting())]
    const report = await runTrendRefresh(deps, { dryRun })

    console.log(`\n${dryRun ? "DRY RUN" : "trend refresh"} · cap ${formatUsd(report.maxCostUsd)}`)
    if (report.skippedReason) console.log(`note: ${report.skippedReason}`)
    console.log(`existing niches (${existing.length}): ${existing.map((n) => n.name).join(", ")}`)
    console.log(`\nsignals (${report.signals.length}):`)
    for (const signal of report.signals.slice(0, 25)) {
      console.log(`  ${signal.id.padEnd(4)} ${signal.kind.padEnd(7)} ${signal.title}`)
    }
    if (report.proposals.length > 0) {
      console.log("\nproposals:")
      for (const p of report.proposals) {
        const verdict = p.accepted ? "✓" : `✗ ${p.reason}`
        console.log(`  ${verdict}  ${p.name} (score ${p.trendScore}, ${p.sources.length} sources)`)
      }
    }
    const list = (label: string, items: string[]) =>
      console.log(`${label}: ${items.length ? items.join(", ") : "none"}`)
    console.log("")
    list(dryRun ? "would archive" : "archived", report.archived)
    list(dryRun ? "would refresh" : "refresh candidates", report.refreshCandidates)
    list("created", report.created)
    list("refreshed", report.refreshed)
    if (report.failures.length) list("failures", report.failures)
    if (report.abortedReason) console.log(`aborted: ${report.abortedReason}`)
    console.log(`spent ≈ ${formatUsd(report.spentUsd)}`)
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
