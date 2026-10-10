import { defineConfig } from "drizzle-kit"
import { loadLocalEnv } from "./scripts/load-env"

loadLocalEnv()

// Migrations need a session-capable connection (session pooler :5432 or direct);
// the app's DATABASE_URL points at the transaction pooler (:6543).
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? ""

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  // Supabase already owns anon/authenticated roles; don't try to create them.
  entities: { roles: { provider: "supabase" } },
  strict: true,
  verbose: true,
})
