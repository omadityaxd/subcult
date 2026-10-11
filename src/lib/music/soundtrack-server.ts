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

/** "This is rage": the niche's verified artists' songs, as 30s previews. Memoized per request. */
export const getSoundtrack = cache(async (slug: string): Promise<Soundtrack | null> => {
  const profile = findSeedProfile(slug)
  if (!profile) return null
  try {
    const { value } = await cached(
      getCacheStore(),
      `subcult:soundtrack:v1:${slug}`,
      SOUNDTRACK_POLICY,
      () =>
        buildSoundtrack({
          artists: nicheArtistsLeadFirst(slug),
          songsFor: (artist) => findArtistSongs(artist.name, SONGS_PER_ARTIST),
        }),
      {
        onStoreError: (operation, error) =>
          log.warn("music.soundtrack_cache_error", { operation, error: errorMessage(error) }),
      },
    )
    return { slug, title: `This is ${profile.name}`, tracks: value }
  } catch (error) {
    log.warn("music.soundtrack_failed", { slug, error: errorMessage(error) })
    return { slug, title: `This is ${profile.name}`, tracks: [] }
  }
})
