/**
 * pnpm doctor
 *
 * Checks every env var and pings each service with a cheap call: key
 * present, reachable, quota left, and whether its features are on. Exits
 * non-zero only when a required service (database, auth, Redis) is missing
 * or broken; optional keys just switch their features off.
 */
import { loadLocalEnv } from "./load-env"

async function main(): Promise<void> {
  loadLocalEnv()
  const { serviceStatus } = await import("../src/lib/doctor/server")
  const { doctorFails, formatTable } = await import("../src/lib/doctor/services")
  const rows = await serviceStatus()
  console.log(formatTable(rows))
  const on = rows.filter((row) => row.on).length
  console.log(`\n${on}/${rows.length} services on.`)
  for (const row of rows.filter((r) => !r.on && !r.required)) {
    console.log(`  off: ${row.label} -> ${row.unlocks}`)
  }
  const fail = doctorFails(rows)
  if (fail) console.log("\nA required service is missing or broken.")
  // Exit only once stdout has flushed (piped through pnpm, an early exit truncates it).
  process.stdout.write("", () => process.exit(fail ? 1 : 0))
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
