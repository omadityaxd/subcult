import type { FeedItem } from "@/lib/feed/types"
import type { Artist } from "@/lib/taxonomy/schema"
import { type Preview, creditsArtist } from "./itunes"

/** What the story viewer plays, plus the music sticker's links. */
export interface StoryMusic {
  title: string
  artist: string
  previewUrl: string
  artworkUrl: string | null
  /** The exact Spotify track when we know it, else the verified artist's page. */
  spotifyUrl: string
  /** Apple Music page: Apple's terms want a store link next to any preview. */
  appleUrl: string | null
}

interface ResolveInput {
  /** Verified artists of the niche, in profile order. */
  artists: readonly Pick<Artist, "name" | "spotifyId">[]
  /** The niche's Spotify feed items (may be empty when Spotify is down). */
  spotifyItems: readonly FeedItem[]
  lookupTrack: (artist: string, title: string) => Promise<Preview | null>
  lookupArtist: (artist: Pick<Artist, "name" | "spotifyId">) => Promise<Preview | null>
  /** Cap on iTunes lookups per story (each is cached, but stay polite). */
  maxLookups?: number
}

/**
 * Pick a 30-second preview for a niche's story: first an exact artist + title
 * match for a Spotify track by one of the niche's verified artists, then a
 * song credited to a verified artist. Null means the story plays silently.
 */
export async function resolveStoryMusic({
  artists,
  spotifyItems,
  lookupTrack,
  lookupArtist,
  maxLookups = 3,
}: ResolveInput): Promise<StoryMusic | null> {
  let lookups = 0
  const candidates = spotifyItems.flatMap((item) => {
    if (item.type !== "track" || !item.subtitle) return []
    const artist = artists.find((a) => creditsArtist(item.subtitle ?? "", a.name))
    return artist ? [{ item, artist }] : []
  })

  for (const { item, artist } of candidates) {
    if (lookups++ >= maxLookups) break
    const preview = await lookupTrack(artist.name, item.title).catch(() => null)
    if (preview) {
      return {
        ...fromPreview(preview),
        title: item.title,
        artist: item.subtitle ?? artist.name,
        spotifyUrl: item.url,
      }
    }
  }

  for (const artist of artists) {
    if (lookups++ >= maxLookups) break
    const preview = await lookupArtist(artist).catch(() => null)
    if (preview) {
      return {
        ...fromPreview(preview),
        spotifyUrl: `https://open.spotify.com/artist/${artist.spotifyId}`,
      }
    }
  }
  return null
}

function fromPreview(preview: Preview): Omit<StoryMusic, "spotifyUrl"> {
  return {
    title: preview.title,
    artist: preview.artist,
    previewUrl: preview.previewUrl,
    artworkUrl: preview.artworkUrl,
    appleUrl: preview.appleUrl,
  }
}
