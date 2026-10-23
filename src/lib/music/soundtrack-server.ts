import "server-only"
import { cache } from "react"
import { cached } from "@/lib/feed/cache"
import { errorMessage, log } from "@/lib/log"
import { findSeedProfile, nicheArtistsLeadFirst } from "@/lib/niches/catalog"
import { SONGS_PER_ARTIST, type Soundtrack, buildSoundtrack } from "./soundtrack"
import { findArtistSongs } from "./itunes"
import { getCacheStore } from "./server"

/**
 * Soundtracks change slowly (new releases); a week fresh, a month as a stale
 * fallback if iTunes is down. Spotify isn't called here at all: ~20 track
 * lookups per niche is exactly the burst that gets a dev-mode app rate
 * limited, and Spotify search links land on the song anyway.
 */
const SOUNDTRACK_POLICY = { freshSeconds: 7 * 24 * 3600, staleSeconds: 30 * 24 * 3600 }
/** An empty build (iTunes throttled or down) is retried after this, never cached for a week. */
const EMPTY_RETRY_SECONDS = 3600

class EmptySoundtrack extends Error {}

/** "This is rage": the niche's verified artists' songs, as 30s previews. Memoized per request. */
export const getSoundtrack = cache(async (slug: string): Promise<Soundtrack | null> => {
  const profile = findSeedProfile(slug)
  if (!profile) return null
  const store = getCacheStore()
  const missKey = `subcult:soundtrack:empty:${slug}`
  try {
    if (await store.get(missKey).catch(() => null)) throw new EmptySoundtrack()
    const { value } = await cached(
      store,
      `subcult:soundtrack:v2:${slug}`,
      SOUNDTRACK_POLICY,
      async () => {
        const tracks = await buildSoundtrack({
          artists: nicheArtistsLeadFirst(slug),
          songsFor: (artist) => findArtistSongs(artist.name, SONGS_PER_ARTIST),
        })
        // Never store "no songs": serve the last good copy, retry within the hour.
        if (tracks.length === 0) {
          await store.set(missKey, 1, EMPTY_RETRY_SECONDS).catch(() => undefined)
          throw new EmptySoundtrack()
        }
        return tracks
      },
      {
        onStoreError: (operation, error) =>
          log.warn("music.soundtrack_cache_error", { operation, error: errorMessage(error) }),
      },
    )
    return { slug, title: `This is ${profile.name}`, tracks: value }
  } catch (error) {
    if (!(error instanceof EmptySoundtrack)) {
      log.warn("music.soundtrack_failed", { slug, error: errorMessage(error) })
    }
    return { slug, title: `This is ${profile.name}`, tracks: [] }
  }
})
