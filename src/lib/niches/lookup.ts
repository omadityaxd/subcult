import "server-only"
import { getDb } from "@/db"
import { createNicheRepository } from "@/db/niche-repository"
import { withTimeout } from "@/lib/concurrency"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { errorMessage, log } from "@/lib/log"
import { findSeedProfile } from "./catalog"

/** Keep pages snappy: a slow database shouldn't hold a niche page hostage. */
const DB_TIMEOUT_MS = 2_500

export type NicheProfileLookup =
  | { status: "found"; profile: NicheProfile; source: "seed" | "database" }
  | { status: "missing" }
  | { status: "unavailable" }

/**
 * Seed catalog first (bundled, always available), then Postgres for
 * user-generated niches. A database outage only affects non-seed niches.
 */
export async function lookupNicheProfile(slug: string): Promise<NicheProfileLookup> {
  const seed = findSeedProfile(slug)
  if (seed) return { status: "found", profile: seed, source: "seed" }

  const db = getDb()
  if (!db) return { status: "missing" }

  try {
    const stored = await withTimeout(
      createNicheRepository(db).findBySlug(slug),
      DB_TIMEOUT_MS,
      "niche lookup",
    )
    return stored
      ? { status: "found", profile: stored.profile, source: "database" }
      : { status: "missing" }
  } catch (error) {
    log.warn("niche.lookup.unavailable", { slug, error: errorMessage(error) })
    return { status: "unavailable" }
  }
}
