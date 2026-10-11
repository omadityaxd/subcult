import "server-only"
import { appFeedDeps } from "@/lib/feed/app-deps"
import { buildNicheFeed } from "@/lib/feed/feed"
import { nicheArtistsLeadFirst } from "@/lib/niches/catalog"
import { lookupNicheProfile } from "@/lib/niches/lookup"
import { findArtistPreview } from "./itunes"
import { cachedPreview, cachedTrackPreview } from "./preview-server"
import { type StoryMusic, resolveStoryMusic } from "./story-music"

/** The 30s preview a niche's story plays, or null (silent story). */
export async function getStoryMusic(slug: string): Promise<StoryMusic | null> {
  const lookup = await lookupNicheProfile(slug)
  if (lookup.status !== "found") return null
  const feed = await buildNicheFeed(lookup.profile, appFeedDeps())

  return resolveStoryMusic({
    // Lead artist first: sister niches (rage, vamp, new-gen) get different songs.
    artists: nicheArtistsLeadFirst(slug),
    spotifyItems: feed.bySource.spotify ?? [],
    lookupTrack: cachedTrackPreview,
    lookupArtist: (artist) =>
      cachedPreview(`subcult:artist-preview:v2:${artist.spotifyId}`, () =>
        findArtistPreview(artist.name),
      ),
  })
}
