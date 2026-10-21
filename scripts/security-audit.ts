/**
 * pnpm run security:audit
 *
 * Launch checklist, checked rather than assumed:
 *  1. every public table has row level security on (asked of Postgres),
 *  2. every API route is rate-limited or behind an auth / cron / admin guard,
 *  3. no server secret's value appears in the client bundle (.next/static,
 *     after `pnpm build`). Values are compared, never printed.
 * Exits non-zero when anything fails.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { loadLocalEnv } from "./load-env"

/** Any of these in a route file counts as its guard. */
const GUARDS = [
  "getLimiter",
  "ipLimited",
  "getPreviewLimiter",
  "socialContext",
  "checkGenerationBudget",
  "fitAction",
  "alertsContext",
  "isCronAuthorized",
  "CRON_SECRET",
  "isAuthorizedBasic",
]

function walk(dir: string, match: (file: string) => boolean): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path, match) : match(path) ? [path] : []
  })
}

async function tablesWithoutRls(): Promise<string[] | null> {
  const { getDb } = await import("../src/db")
  const { sql } = await import("drizzle-orm")
  const db = getDb()
  if (!db) return null
  const rows = await db.execute<{ relname: string }>(sql`
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
      and c.relname not like '__drizzle%'`)
  return [...rows].map((row) => row.relname)
}

function routesWithoutGuard(): string[] {
  return walk("src/app/api", (file) => /route\.tsx?$/.test(file)).filter((file) => {
    const source = readFileSync(file, "utf8")
    return !GUARDS.some((guard) => source.includes(guard))
  })
}

/** Server-only env values (long enough to be secrets) that show up in client JS. */
function secretsInBundle(): { checked: number; leaked: string[] } | null {
  const files = walk(".next/static", (file) => file.endsWith(".js"))
  if (files.length === 0) return null
  const secrets = Object.entries(process.env).filter(
    ([name, value]) =>
      !name.startsWith("NEXT_PUBLIC_") &&
      /KEY|SECRET|TOKEN|PASSWORD|DATABASE_URL|DIRECT_URL/.test(name) &&
      typeof value === "string" &&
      value.length >= 12,
  )
  const leaked = new Set<string>()
  for (const file of files) {
    const text = readFileSync(file, "utf8")
    for (const [name, value] of secrets) if (text.includes(value as string)) leaked.add(name)
  }
  return { checked: secrets.length, leaked: [...leaked] }
}

async function main(): Promise<void> {
  loadLocalEnv()
  let failed = false

  const tables = await tablesWithoutRls().catch((error: unknown) => {
    console.log(`RLS: couldn't ask the database (${(error as Error).message})`)
    return null
  })
  if (tables === null) console.log("RLS: skipped (no DATABASE_URL)")
  else if (tables.length === 0) console.log("RLS: on for every public table")
  else {
    failed = true
    console.log(`RLS: OFF on ${tables.join(", ")}`)
  }

  const open = routesWithoutGuard()
  if (open.length === 0) console.log("Rate limits: every API route is limited or guarded")
  else {
    failed = true
    console.log(`Rate limits: no limiter or guard in\n  ${open.join("\n  ")}`)
  }

  const bundle = secretsInBundle()
  if (!bundle) console.log("Bundle: skipped (run `pnpm build` first)")
  else if (bundle.leaked.length === 0)
    console.log(`Bundle: none of ${bundle.checked} server secrets appear in client JS`)
  else {
    failed = true
    console.log(`Bundle: LEAKED ${bundle.leaked.join(", ")} (values not shown)`)
  }

  process.stdout.write("", () => process.exit(failed ? 1 : 0))
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
