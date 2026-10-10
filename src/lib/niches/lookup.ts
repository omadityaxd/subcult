import "server-only"
import { getDb } from "@/db"
import { createNicheRepository } from "@/db/niche-repository"
import { withTimeout } from "@/lib/concurrency"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { errorMessage, log } from "@/lib/log"
import { findSeedProfile } from "./catalog"
import type { NicheKind, NicheStatus, TrendSource } from "./lifecycle"

/** Keep pages snappy: a slow database shouldn't hold a niche page hostage. */
const DB_TIMEOUT_MS = 2_500

/** Lifecycle details for DB niches (null for curated seeds, which are evergreen). */
export interface NicheMeta {
  kind: NicheKind
  status: NicheStatus
  publishedAt: Date
  trendScore: number | null
  sources: TrendSource[]
}

export type NicheProfileLookup =
  | { status: "found"; profile: NicheProfile; source: "seed" | "database"; meta: NicheMeta | null }
  | { status: "missing" }
  | { status: "unavailable" }

/**
 * Seed catalog first (bundled, always available), then Postgres for
 * user-generated niches. A database outage only affects non-seed niches.
 */
export async function lookupNicheProfile(slug: string): Promise<NicheProfileLookup> {
  const seed = findSeedProfile(slug)
  if (seed) return { status: "found", profile: seed, source: "seed", meta: null }

  const db = getDb()
  if (!db) return { status: "missing" }

  try {
    const stored = await withTimeout(
      createNicheRepository(db).findBySlug(slug),
      DB_TIMEOUT_MS,
      "niche lookup",
    )
    // Hidden niches (admin action) are gone; archived trends stay reachable by URL.
    if (!stored || stored.status === "hidden") return { status: "missing" }
    return {
      status: "found",
      profile: stored.profile,
      source: "database",
      meta: {
        kind: stored.kind,
        status: stored.status,
        publishedAt: stored.publishedAt,
        trendScore: stored.trendScore,
        sources: stored.sources,
      },
    }
  } catch (error) {
    log.warn("niche.lookup.unavailable", { slug, error: errorMessage(error) })
    return { status: "unavailable" }
  }
}
