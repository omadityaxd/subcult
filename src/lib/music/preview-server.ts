import "server-only"
import { cached } from "@/lib/feed/cache"
import { errorMessage, log } from "@/lib/log"
import { lookupKey } from "@/lib/taxonomy/graph"
import { type Preview, findArtistSongs, findTrackPreview, normalizeTitle } from "./itunes"
import { getCacheStore } from "./server"

/** Preview matches change rarely; misses are cached too, so we don't re-ask iTunes all day. */
const PREVIEW_POLICY = { freshSeconds: 7 * 24 * 3600, staleSeconds: 30 * 24 * 3600 }

export function cachedPreview<T>(key: string, load: () => Promise<T>): Promise<T> {
  return cached(getCacheStore(), key, PREVIEW_POLICY, load, {
    onStoreError: (operation, error) =>
      log.warn("music.preview_cache_error", { operation, error: errorMessage(error) }),
  }).then((result) => result.value)
}

/** A song iTunes didn't have is asked about again after a day, not a week. */
const MISS_TTL_SECONDS = 24 * 3600

/**
 * The song's 30s preview (iTunes, fuzzy match with a looser retry), cached
 * by artist + normalized title: hits for a week, misses for a day.
 */
export async function cachedTrackPreview(artist: string, title: string): Promise<Preview | null> {
  const key = `subcult:preview:v2:${lookupKey(artist)}:${normalizeTitle(title)}`
  const store = getCacheStore()
  if (await store.get(`${key}:miss`).catch(() => null)) return null
  const hit = await cachedPreview(key, async () => {
    const found = await findTrackPreview(artist, title)
    // A miss isn't cached under the hit key (a week); it gets its own day-long marker.
    if (!found) throw new PreviewMiss()
    return found
  }).catch((error: unknown) => {
    if (error instanceof PreviewMiss) return null
    throw error
  })
  if (!hit) await store.set(`${key}:miss`, 1, MISS_TTL_SECONDS).catch(() => undefined)
  return hit
}

class PreviewMiss extends Error {}

/** An artist's best-known songs with previews: the artist sheet's playable top tracks. */
export function cachedArtistSongs(artist: string, limit: number): Promise<Preview[]> {
  return cachedPreview(`subcult:artist-songs:v1:${lookupKey(artist)}:${limit}`, () =>
    findArtistSongs(artist, limit),
  )
}
