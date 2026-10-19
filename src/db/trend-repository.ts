import { and, asc, desc, eq, gt, isNull, lt, lte, ne, or, sql } from "drizzle-orm"
import type { NicheProfile } from "../lib/engine/profile-schema"
import type { NicheStatus } from "../lib/niches/lifecycle"
import type { NewTrendingNiche, TrendStore } from "../lib/trends/types"
import type { Database } from "./create-db"
import { niches } from "./schema"

const activeTrending = and(eq(niches.kind, "trending"), eq(niches.status, "active"))

export function createTrendStore(db: Database): TrendStore {
  return {
    async listExisting() {
      const rows = await db
        .select({ slug: niches.slug, name: niches.name, profile: niches.profile })
        .from(niches)
      return rows.map((row) => ({
        slug: row.slug,
        name: row.name,
        relatedNiches: row.profile.relatedNiches,
      }))
    },

    async findExpired(now) {
      const rows = await db
        .select({ slug: niches.slug })
        .from(niches)
        .where(and(activeTrending, lte(niches.expiresAt, now)))
      return rows.map((row) => row.slug)
    },

    async archiveExpired(now) {
      const rows = await db
        .update(niches)
        .set({ status: "archived" })
        .where(and(activeTrending, lte(niches.expiresAt, now)))
        .returning({ slug: niches.slug })
      return rows.map((row) => row.slug)
    },

    async listRefreshCandidates(olderThan, limit) {
      const lastTouched = sql`coalesce(${niches.refreshedAt}, ${niches.publishedAt})`
      return db
        .select({ slug: niches.slug, name: niches.name })
        .from(niches)
        .where(and(activeTrending, lt(lastTouched, olderThan)))
        .orderBy(asc(lastTouched))
        .limit(limit)
    },

    async insertTrending(niche) {
      const rows = await db
        .insert(niches)
        .values(trendingRow(niche))
        .onConflictDoNothing({ target: niches.slug })
        .returning({ slug: niches.slug })
      return rows.length > 0
    },

    async updateProfile(slug, profile, refreshedAt) {
      await db
        .update(niches)
        .set({ profile, schemaVersion: profile.schemaVersion, refreshedAt })
        .where(eq(niches.slug, slug))
    },
  }
}

function trendingRow(niche: NewTrendingNiche) {
  return {
    slug: niche.profile.slug,
    name: niche.profile.name,
    profile: niche.profile,
    schemaVersion: niche.profile.schemaVersion,
    generatedBy: "trend" as const,
    model: niche.model,
    inputTokens: niche.inputTokens,
    outputTokens: niche.outputTokens,
    kind: "trending" as const,
    status: "active" as const,
    trendScore: niche.trendScore,
    sources: niche.sources,
    publishedAt: niche.publishedAt,
    expiresAt: niche.expiresAt,
  }
}

/**
 * Upsert for hand-researched trend files (/refresh-trends): inserts new trends,
 * updates existing *trending* rows, never touches evergreen niches.
 */
export async function upsertTrendingNiche(
  db: Database,
  niche: NewTrendingNiche,
): Promise<"inserted" | "updated" | "skipped"> {
  const rows = await db
    .insert(niches)
    .values(trendingRow(niche))
    .onConflictDoUpdate({
      target: niches.slug,
      set: {
        profile: sql`excluded.profile`,
        sources: sql`excluded.sources`,
        trendScore: sql`excluded.trend_score`,
        refreshedAt: niche.publishedAt,
      },
      setWhere: sql`${niches.kind} = 'trending'`,
    })
    .returning({ inserted: sql<boolean>`(xmax = 0)` })
  if (rows.length === 0) return "skipped"
  return rows[0].inserted ? "inserted" : "updated"
}

export interface TrendingCard {
  slug: string
  name: string
  emoji: string
  tagline: string
  palette: string[]
  publishedAt: Date
  trendScore: number | null
}

/** Explore's "trending now" row: active, unexpired trends, hottest first. */
export async function listActiveTrending(
  db: Database,
  now: Date,
  limit = 10,
): Promise<TrendingCard[]> {
  const rows = await db
    .select({
      profile: niches.profile,
      publishedAt: niches.publishedAt,
      trendScore: niches.trendScore,
    })
    .from(niches)
    // Typed operators, not a raw sql template: they encode the Date for the driver.
    .where(and(activeTrending, or(isNull(niches.expiresAt), gt(niches.expiresAt, now))))
    .orderBy(sql`${niches.trendScore} desc nulls last`, desc(niches.publishedAt))
    .limit(limit)
  return rows.map(({ profile, publishedAt, trendScore }) =>
    toCard(profile, publishedAt, trendScore),
  )
}

const toCard = (
  profile: NicheProfile,
  publishedAt: Date,
  trendScore: number | null,
): TrendingCard => ({
  slug: profile.slug,
  name: profile.name,
  emoji: profile.emoji,
  tagline: profile.tagline,
  palette: profile.palette,
  publishedAt,
  trendScore,
})

export interface ManagedNiche {
  slug: string
  name: string
  emoji: string
  kind: string
  status: NicheStatus
  generatedBy: string
  publishedAt: Date
  expiresAt: Date | null
}

/** Admin list: every non-seed niche (seeds live in /data/niches and are managed in git). */
export async function listManagedNiches(db: Database, limit = 200): Promise<ManagedNiche[]> {
  const rows = await db
    .select()
    .from(niches)
    .where(ne(niches.generatedBy, "seed"))
    .orderBy(desc(niches.publishedAt))
    .limit(limit)
  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    emoji: row.profile.emoji,
    kind: row.kind,
    status: row.status,
    generatedBy: row.generatedBy,
    publishedAt: row.publishedAt,
    expiresAt: row.expiresAt,
  }))
}

export async function setNicheStatus(
  db: Database,
  slug: string,
  status: NicheStatus,
): Promise<boolean> {
  const rows = await db
    .update(niches)
    .set({ status })
    .where(and(eq(niches.slug, slug), ne(niches.generatedBy, "seed")))
    .returning({ slug: niches.slug })
  return rows.length > 0
}
