import { sql } from "drizzle-orm"
import {
  bigint,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
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

// --- The social layer: user fits ---------------------------------------------
// All writes go through server routes that verify the Supabase session; the
// database role the app uses bypasses RLS, so RLS here only governs what the
// public Supabase API could read: visible fits and public profiles, nothing else.

/** Public identity for fits: a handle the user picks. Never their email. */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(), // = auth.users.id
    handle: text("handle").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("profiles_public_read", {
      for: "select",
      to: [anonRole, authenticatedRole],
      using: sql`true`,
    }),
  ],
)

export interface FitPiece {
  label: string
  brand: string | null
}

export interface FitSong {
  title: string
  artist: string
  previewUrl: string
  artworkUrl: string | null
  spotifyUrl: string | null
}

export const FIT_STATUSES = ["visible", "hidden"] as const
export type FitStatus = (typeof FIT_STATUSES)[number]

export const fits = pgTable(
  "fits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    /** Path inside the "fits" storage bucket: <user id>/<fit id>.webp */
    imagePath: text("image_path").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    caption: text("caption"),
    niches: text("niches")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    brands: text("brands")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    pieces: jsonb("pieces").$type<FitPiece[]>().notNull().default([]),
    song: jsonb("song").$type<FitSong | null>(),
    status: text("status").$type<FitStatus>().notNull().default("visible"),
    likeCount: integer("like_count").notNull().default(0),
    reportCount: integer("report_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fits_status_created_idx").on(table.status, table.createdAt.desc()),
    index("fits_user_created_idx").on(table.userId, table.createdAt.desc()),
    index("fits_niches_idx").using("gin", table.niches),
    pgPolicy("fits_public_read_visible", {
      for: "select",
      to: [anonRole, authenticatedRole],
      using: sql`${table.status} = 'visible'`,
    }),
  ],
)

export type FitRow = typeof fits.$inferSelect

export const fitLikes = pgTable(
  "fit_likes",
  {
    fitId: uuid("fit_id")
      .notNull()
      .references(() => fits.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.fitId, table.userId] })],
).enableRLS()

export const fitSaves = pgTable(
  "fit_saves",
  {
    fitId: uuid("fit_id")
      .notNull()
      .references(() => fits.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.fitId, table.userId] }),
    index("fit_saves_user_idx").on(table.userId, table.createdAt.desc()),
  ],
).enableRLS()

export const fitReports = pgTable(
  "fit_reports",
  {
    fitId: uuid("fit_id")
      .notNull()
      .references(() => fits.id, { onDelete: "cascade" }),
    reporterId: uuid("reporter_id").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.fitId, table.reporterId] })],
).enableRLS()
