/**
 * pnpm rising:print [--save]
 *
 * Computes momentum live (5 weeks of headlines, uploads, releases and in-app
 * saves/plays) and prints the top rising entities with their scores.
 * --save also stores the snapshot the app reads.
 */
import { loadLocalEnv } from "./load-env"

async function main(): Promise<void> {
  loadLocalEnv()
  const { computeRisingSnapshot, saveRisingSnapshot } = await import("../src/lib/rising/server")
  const started = Date.now()
  const snapshot = await computeRisingSnapshot()
  console.log(
    `computed in ${((Date.now() - started) / 1000).toFixed(0)}s; events by source:`,
    snapshot.sources,
  )
  console.log("\nTop 10 rising entities")
  console.log("  score  ratio  last7  prior28  entity")
  for (const m of snapshot.entities.slice(0, 10)) {
    console.log(
      `  ${m.score.toFixed(2).padStart(5)}  ${m.ratio.toFixed(2).padStart(5)}  ${m.last7.toFixed(1).padStart(5)}  ${m.prior28.toFixed(1).padStart(7)}  ${m.label} (${m.entity}; ${m.niches.join(", ")})`,
    )
  }
  if (process.argv.includes("--save")) {
    await saveRisingSnapshot(snapshot)
    console.log("\nsaved snapshot")
  }
  process.exit(0)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
