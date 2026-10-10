import { sql } from "drizzle-orm"
import { index, integer, jsonb, pgPolicy, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { anonRole, authenticatedRole } from "drizzle-orm/supabase"
import type { GeneratedBy } from "../lib/engine/niche-service"
import type { NicheProfile } from "../lib/engine/profile-schema"

/**
 * One row per niche, keyed by normalized slug. Profiles are written once
 * (after Zod validation) and served forever: this table is the LLM cache.
 * Reads are public; writes happen server-side with the service connection.
 */
export const niches = pgTable(
  "niches",
  {
    slug: text("slug").primaryKey(),
    name: text("name").notNull(),
    profile: jsonb("profile").$type<NicheProfile>().notNull(),
    schemaVersion: integer("schema_version").notNull(),
    generatedBy: text("generated_by").$type<GeneratedBy>().notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("niches_created_at_idx").on(table.createdAt.desc()),
    pgPolicy("niches_public_read", {
      for: "select",
      to: [anonRole, authenticatedRole],
      using: sql`true`,
    }),
  ],
)

export type NicheRow = typeof niches.$inferSelect
export type NewNicheRow = typeof niches.$inferInsert
