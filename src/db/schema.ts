import { sql } from "drizzle-orm"
import {
  bigint,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { anonRole, authenticatedRole } from "drizzle-orm/supabase"
import type { GeneratedBy } from "../lib/engine/niche-service"
import type { NicheProfile } from "../lib/engine/profile-schema"
import type { UsagePurpose, UsageStatus } from "../lib/engine/usage"
import type { NicheKind, NicheStatus, TrendSource } from "../lib/niches/lifecycle"

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
    // Lifecycle (trend engine). Seeds and user niches are evergreen and never expire.
    kind: text("kind").$type<NicheKind>().notNull().default("evergreen"),
    status: text("status").$type<NicheStatus>().notNull().default("active"),
    trendScore: real("trend_score"),
    sources: jsonb("sources").$type<TrendSource[]>().notNull().default([]),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    refreshedAt: timestamp("refreshed_at", { withTimezone: true }),
  },
  (table) => [
    index("niches_created_at_idx").on(table.createdAt.desc()),
    index("niches_kind_status_published_idx").on(
      table.kind,
      table.status,
      table.publishedAt.desc(),
    ),
    pgPolicy("niches_public_read", {
      for: "select",
      to: [anonRole, authenticatedRole],
      using: sql`true`,
    }),
  ],
)

export type NicheRow = typeof niches.$inferSelect
export type NewNicheRow = typeof niches.$inferInsert

/**
 * Token + cost ledger, one row per LLM job. Drives the global daily cap, the
 * trend-run budget and /admin/usage. RLS on with no policies: server-only.
 */
export const llmUsage = pgTable(
  "llm_usage",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    purpose: text("purpose").$type<UsagePurpose>().notNull(),
    subject: text("subject").notNull(),
    model: text("model").notNull(),
    status: text("status").$type<UsageStatus>().notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    attempts: integer("attempts").notNull(),
    costUsd: doublePrecision("cost_usd"),
    durationMs: integer("duration_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("llm_usage_purpose_created_at_idx").on(table.purpose, table.createdAt.desc())],
).enableRLS()

export type LlmUsageRow = typeof llmUsage.$inferSelect
