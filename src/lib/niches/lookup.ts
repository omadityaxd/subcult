import "server-only"
import { getDb } from "@/db"
import { createNicheRepository } from "@/db/niche-repository"
import { withTimeout } from "@/lib/concurrency"
import type { StoredNiche } from "@/lib/engine/niche-service"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { errorMessage, log } from "@/lib/log"
import { findSeedProfile } from "./catalog"
import type { NicheKind, NicheStatus, TrendSource } from "./lifecycle"

/** Keep pages snappy: a slow database shouldn't hold a niche page hostage. */
const DB_TIMEOUT_MS = 2_500

/** Lifecycle details from the database (null when served from the bundled fallback). */
export interface NicheMeta {
  kind: NicheKind
  status: NicheStatus
  publishedAt: Date
  trendScore: number | null
  sources: TrendSource[]
}

/** Where a profile came from: Postgres, or the bundled seed JSON as a fallback. */
export type NicheSource = "database" | "bundled-fallback"

export type NicheProfileLookup =
  | { status: "found"; profile: NicheProfile; source: NicheSource; meta: NicheMeta | null }
  | { status: "missing" }
  | { status: "unavailable" }

const metaOf = (stored: StoredNiche): NicheMeta => ({
  kind: stored.kind,
  status: stored.status,
  publishedAt: stored.publishedAt,
  trendScore: stored.trendScore,
  sources: stored.sources,
})

/**
 * Postgres is the source of truth; the curated seed JSON bundled with the app
 * is the fallback when the database is unset, unreachable, slow, or not yet
 * seeded. So seeds always render, and DB edits (re-seeds, hiding) take effect.
 */
export async function lookupNicheProfile(slug: string): Promise<NicheProfileLookup> {
  const seed = findSeedProfile(slug)
  const fallback = (): NicheProfileLookup =>
    seed
      ? { status: "found", profile: seed, source: "bundled-fallback", meta: null }
      : { status: "missing" }

  const db = getDb()
  if (!db) return fallback()

  let stored: StoredNiche | null
  try {
    stored = await withTimeout(
      createNicheRepository(db).findBySlug(slug),
      DB_TIMEOUT_MS,
      "niche lookup",
    )
  } catch (error) {
    log.warn("niche.lookup.db-unavailable", {
      slug,
      error: errorMessage(error),
      seedFallback: Boolean(seed),
    })
    return seed ? fallback() : { status: "unavailable" }
  }

  if (!stored) return fallback()
  // Hidden niches (admin action) are gone; archived trends stay reachable by URL.
  if (stored.status === "hidden") return { status: "missing" }
  return { status: "found", profile: stored.profile, source: "database", meta: metaOf(stored) }
}
