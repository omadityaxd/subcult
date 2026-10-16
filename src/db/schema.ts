import { sql } from "drizzle-orm"
import {
  bigint,
  boolean,
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
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { anonRole, authenticatedRole } from "drizzle-orm/supabase"
import type { GeneratedBy } from "../lib/engine/niche-service"
import type { NicheProfile } from "../lib/engine/profile-schema"
import type { UsagePurpose, UsageStatus } from "../lib/engine/usage"
import type { NicheKind, NicheStatus, TrendSource } from "../lib/niches/lifecycle"
import type { SignalKind } from "../lib/taste/model"
import type { AlertType } from "../lib/alerts/policy"

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

// --- Taste: implicit signals behind each person's affinity vector -----------
// Written only through /api/taste for the signed-in user; never public.

export const tasteSignals = pgTable(
  "taste_signals",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id").notNull(),
    kind: text("kind").$type<SignalKind>().notNull(),
    /** "artist:nettspend", "brand:rick-owens", "niche:rage", "tag:…" */
    entity: text("entity").notNull(),
    label: text("label").notNull(),
    strength: real("strength").notNull().default(1),
    /** When it happened on the device (ms epoch), so merges dedupe exactly. */
    at: bigint("at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("taste_signals_event_idx").on(table.userId, table.kind, table.entity, table.at),
    index("taste_signals_user_at_idx").on(table.userId, table.at.desc()),
  ],
).enableRLS()

export type TasteSignalRow = typeof tasteSignals.$inferSelect

// --- Alerts: notification center, web push, grail hunts ---------------------
// Server-only (RLS on, no policies): every read and write goes through routes
// that check the session.

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    endpoint: text("endpoint").primaryKey(),
    userId: uuid("user_id").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("push_subscriptions_user_idx").on(table.userId)],
).enableRLS()

export const notifications = pgTable(
  "notifications",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id").notNull(),
    type: text("type").$type<AlertType>().notNull(),
    title: text("title").notNull(),
    body: text("body"),
    url: text("url").notNull(),
    imageUrl: text("image_url"),
    /** Same event never notifies twice ("drop:itunes:123", "grail:<search>:<listing>"). */
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
    pushedAt: timestamp("pushed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("notifications_dedupe_idx").on(table.userId, table.dedupeKey),
    index("notifications_user_created_idx").on(table.userId, table.createdAt.desc()),
  ],
).enableRLS()

export const alertPrefs = pgTable("alert_prefs", {
  userId: uuid("user_id").primaryKey(),
  drops: boolean("drops").notNull().default(true),
  grails: boolean("grails").notNull().default(true),
  niches: boolean("niches").notNull().default(true),
  friends: boolean("friends").notNull().default(true),
  /** Minutes after local midnight; default 23:00–09:00. */
  quietStart: integer("quiet_start")
    .notNull()
    .default(23 * 60),
  quietEnd: integer("quiet_end")
    .notNull()
    .default(9 * 60),
  timeZone: text("time_zone").notNull().default("UTC"),
  lastPushAt: timestamp("last_push_at", { withTimezone: true }),
  lastNicheAlertAt: timestamp("last_niche_alert_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS()

export const grailSearches = pgTable(
  "grail_searches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    brandSlug: text("brand_slug").notNull(),
    brand: text("brand").notNull(),
    item: text("item").notNull(),
    maxPrice: integer("max_price").notNull(),
    size: text("size"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  },
  (table) => [index("grail_searches_user_idx").on(table.userId)],
).enableRLS()

export type NotificationRow = typeof notifications.$inferSelect
export type AlertPrefsRow = typeof alertPrefs.$inferSelect
export type GrailSearchRow = typeof grailSearches.$inferSelect

// --- Friends: follows, blocks, privacy, opt-in listening ---------------------
// Separate from `profiles` (which the public Supabase API can read): these are
// server-only, so a friends-only profile or a listening status never leaks.

export const PROFILE_VISIBILITY = ["public", "friends"] as const
export type ProfileVisibility = (typeof PROFILE_VISIBILITY)[number]

export interface NowPlaying {
  title: string
  artist: string
  artworkUrl: string | null
}

export const profileSettings = pgTable("profile_settings", {
  userId: uuid("user_id").primaryKey(),
  /** "friends": only people you follow back see your fits, niches and listening. */
  visibility: text("visibility").$type<ProfileVisibility>().notNull().default("public"),
  /** Opt-in: show what you're playing on your profile. */
  shareListening: boolean("share_listening").notNull().default(false),
  listening: jsonb("listening").$type<NowPlaying | null>(),
  listeningAt: timestamp("listening_at", { withTimezone: true }),
}).enableRLS()

export const userFollows = pgTable(
  "user_follows",
  {
    followerId: uuid("follower_id").notNull(),
    followeeId: uuid("followee_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.followerId, table.followeeId] }),
    index("user_follows_followee_idx").on(table.followeeId),
  ],
).enableRLS()

export const userBlocks = pgTable(
  "user_blocks",
  {
    blockerId: uuid("blocker_id").notNull(),
    blockedId: uuid("blocked_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.blockerId, table.blockedId] })],
).enableRLS()
