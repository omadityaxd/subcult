import { eq } from "drizzle-orm"
import type { NicheRepository, StoredNiche } from "../lib/engine/niche-service"
import type { Database } from "./create-db"
import { type NicheRow, niches } from "./schema"

function toStoredNiche(row: NicheRow): StoredNiche {
  return {
    slug: row.slug,
    name: row.name,
    profile: row.profile,
    generatedBy: row.generatedBy,
    createdAt: row.createdAt,
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
