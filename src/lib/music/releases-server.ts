import "server-only"
import { cached } from "@/lib/feed/cache"
import { errorMessage, log } from "@/lib/log"
import { getCacheStore } from "./server"
import {
  type Release,
  findCollectionPreview,
  findItunesArtistId,
  findRecentReleases,
} from "./releases"

/** Artist ids don't change; releases are checked twice a day. */
const ID_POLICY = { freshSeconds: 30 * 24 * 3600, staleSeconds: 90 * 24 * 3600 }
const RELEASE_POLICY = { freshSeconds: 12 * 3600, staleSeconds: 3 * 24 * 3600 }
/** Releases from the last five weeks: Today shows ≤14 days, rising needs the baseline. */
const WINDOW_DAYS = 35

/** An artist's releases from the last 5 weeks (cached). [] when iTunes doesn't know them. */
export async function artistReleases(artistSlug: string, name: string): Promise<Release[]> {
  try {
    const { value: id } = await cached(
      getCacheStore(),
      `subcult:itunes-artist:v1:${artistSlug}`,
      ID_POLICY,
      () => findItunesArtistId(name),
    )
    if (id === null) return []
    const { value } = await cached(
      getCacheStore(),
      `subcult:releases:v2:${id}`,
      RELEASE_POLICY,
      () => findRecentReleases(id, name, { days: WINDOW_DAYS }),
    )
    return value
  } catch (error) {
    log.warn("releases.failed", { artistSlug, error: errorMessage(error) })
    return []
  }
}

/** A release's songs don't change: its preview is cached for a month (a miss for a day). */
const PREVIEW_POLICY = { freshSeconds: 30 * 24 * 3600, staleSeconds: 60 * 24 * 3600 }

/** The preview for a release id ("itunes:<collectionId>"), or null. Never throws. */
export async function releasePreview(releaseId: string): Promise<string | null> {
  const collectionId = releaseId.match(/^itunes:(\d+)$/)?.[1]
  if (!collectionId) return null
  try {
    const { value } = await cached(
      getCacheStore(),
      `subcult:release-preview:v1:${collectionId}`,
      PREVIEW_POLICY,
      () => findCollectionPreview(collectionId),
    )
    return value?.previewUrl ?? null
  } catch (error) {
    log.warn("releases.preview_failed", { collectionId, error: errorMessage(error) })
    return null
  }
}
