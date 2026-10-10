import "server-only"
import { appFeedDeps } from "@/lib/feed/app-deps"
import { cached } from "@/lib/feed/cache"
import { buildNicheFeed } from "@/lib/feed/feed"
import { errorMessage, log } from "@/lib/log"
import { nicheArtistsLeadFirst } from "@/lib/niches/catalog"
import { lookupNicheProfile } from "@/lib/niches/lookup"
import { lookupKey } from "@/lib/taxonomy/graph"
import { type Preview, findArtistPreview, findTrackPreview, normalizeTitle } from "./itunes"
import { getCacheStore } from "./server"
import { type StoryMusic, resolveStoryMusic } from "./story-music"

/** Preview matches change rarely; misses are cached too, so we don't re-ask iTunes all day. */
const PREVIEW_POLICY = { freshSeconds: 7 * 24 * 3600, staleSeconds: 30 * 24 * 3600 }

function cachedPreview(key: string, load: () => Promise<Preview | null>) {
  return cached(getCacheStore(), key, PREVIEW_POLICY, load, {
    onStoreError: (operation, error) =>
      log.warn("music.preview_cache_error", { operation, error: errorMessage(error) }),
  }).then((result) => result.value)
}

/** The 30s preview a niche's story plays, or null (silent story). */
export async function getStoryMusic(slug: string): Promise<StoryMusic | null> {
  const lookup = await lookupNicheProfile(slug)
  if (lookup.status !== "found") return null
  const feed = await buildNicheFeed(lookup.profile, appFeedDeps())

  return resolveStoryMusic({
    // Lead artist first: sister niches (rage, vamp, new-gen) get different songs.
    artists: nicheArtistsLeadFirst(slug),
    spotifyItems: feed.bySource.spotify ?? [],
    lookupTrack: (artist, title) =>
      cachedPreview(`subcult:preview:v1:${lookupKey(artist)}:${normalizeTitle(title)}`, () =>
        findTrackPreview(artist, title),
      ),
    lookupArtist: (artist) =>
      cachedPreview(`subcult:artist-preview:v2:${artist.spotifyId}`, () =>
        findArtistPreview(artist.name),
      ),
  })
}
