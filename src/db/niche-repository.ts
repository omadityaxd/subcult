import { eq, sql } from "drizzle-orm"
import type { NicheRepository, StoredNiche } from "../lib/engine/niche-service"
import type { NicheProfile } from "../lib/engine/profile-schema"
import type { Database } from "./create-db"
import { type NicheRow, niches } from "./schema"

export interface SeedUpsertResult {
  inserted: string[]
  updated: string[]
  unchanged: number
}

/**
 * Idempotent upsert of curated profiles. Only rows that are themselves seeds
 * and whose JSON actually changed get rewritten; user-generated rows are never
 * touched. `xmax = 0` is Postgres's tell for "this row was freshly inserted".
 */
export async function upsertSeedProfiles(
  db: Database,
  profiles: readonly NicheProfile[],
): Promise<SeedUpsertResult> {
  if (profiles.length === 0) return { inserted: [], updated: [], unchanged: 0 }

  const rows = await db
    .insert(niches)
    .values(
      profiles.map((profile) => ({
        slug: profile.slug,
        name: profile.name,
        profile,
        schemaVersion: profile.schemaVersion,
        generatedBy: "seed" as const,
        model: "curated",
      })),
    )
    .onConflictDoUpdate({
      target: niches.slug,
      set: {
        name: sql`excluded.name`,
        profile: sql`excluded.profile`,
        schemaVersion: sql`excluded.schema_version`,
      },
      setWhere: sql`${niches.generatedBy} = 'seed' and ${niches.profile} is distinct from excluded.profile`,
    })
    .returning({ slug: niches.slug, inserted: sql<boolean>`(xmax = 0)` })

  return {
    inserted: rows.filter((row) => row.inserted).map((row) => row.slug),
    updated: rows.filter((row) => !row.inserted).map((row) => row.slug),
    unchanged: profiles.length - rows.length,
  }
}

export function toStoredNiche(row: NicheRow): StoredNiche {
  return {
    slug: row.slug,
    name: row.name,
    profile: row.profile,
    generatedBy: row.generatedBy,
    createdAt: row.createdAt,
    kind: row.kind,
    status: row.status,
    trendScore: row.trendScore,
    sources: row.sources,
    publishedAt: row.publishedAt,
    expiresAt: row.expiresAt,
  }
}

export function createNicheRepository(db: Database): NicheRepository {
  async function findBySlug(slug: string): Promise<StoredNiche | null> {
    const [row] = await db.select().from(niches).where(eq(niches.slug, slug)).limit(1)
    return row ? toStoredNiche(row) : null
  }

  return {
    findBySlug,

    async insert(niche) {
      const [row] = await db
        .insert(niches)
        .values({
          slug: niche.profile.slug,
          name: niche.profile.name,
          profile: niche.profile,
          schemaVersion: niche.profile.schemaVersion,
          generatedBy: niche.generatedBy,
          model: niche.model,
          inputTokens: niche.inputTokens,
          outputTokens: niche.outputTokens,
        })
        .onConflictDoNothing({ target: niches.slug })
        .returning()
      if (row) return toStoredNiche(row)

      // Lost a race with another writer: the stored row wins.
      const existing = await findBySlug(niche.profile.slug)
      if (!existing) throw new Error(`Niche ${niche.profile.slug} vanished after insert conflict`)
      return existing
    },

    async listSlugs() {
      const rows = await db.select({ slug: niches.slug }).from(niches)
      return rows.map((row) => row.slug)
    },
  }
}
