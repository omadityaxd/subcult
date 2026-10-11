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

/** The exact song's 30s preview (iTunes), cached by artist + normalized title. */
export function cachedTrackPreview(artist: string, title: string): Promise<Preview | null> {
  return cachedPreview(`subcult:preview:v1:${lookupKey(artist)}:${normalizeTitle(title)}`, () =>
    findTrackPreview(artist, title),
  )
}

/** An artist's best-known songs with previews: the artist sheet's playable top tracks. */
export function cachedArtistSongs(artist: string, limit: number): Promise<Preview[]> {
  return cachedPreview(`subcult:artist-songs:v1:${lookupKey(artist)}:${limit}`, () =>
    findArtistSongs(artist, limit),
  )
}
