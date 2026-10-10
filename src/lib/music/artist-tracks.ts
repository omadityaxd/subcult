import type { SpotifyClient, SpotifySearchResponse } from "@/lib/sources/spotify"

export interface ArtistTrack {
  id: string
  title: string
  artists: string
  album: string
  imageUrl: string | null
  url: string
}

/** Tracks from a search response that actually credit this Spotify artist ID. */
export function tracksCrediting(response: SpotifySearchResponse, artistId: string): ArtistTrack[] {
  return (response.tracks?.items ?? []).flatMap((track) =>
    track && track.artists.some((artist) => artist.id === artistId)
      ? [
          {
            id: track.id,
            title: track.name,
            artists: track.artists.map((artist) => artist.name).join(", "),
            album: track.album.name,
            imageUrl: track.album.images[0]?.url ?? null,
            url: track.external_urls.spotify,
          },
        ]
      : [],
  )
}

/**
 * An artist's most relevant tracks. Spotify's top-tracks endpoint is off-limits
 * in dev mode and the artist:"…" search filter is fuzzy, so: plain-name search,
 * then keep only tracks credited to the verified artist ID.
 */
export async function findArtistTracks(
  spotify: SpotifyClient,
  artist: { name: string; spotifyId: string },
  limit = 5,
): Promise<ArtistTrack[]> {
  const response = await spotify.search(artist.name, "track", 10)
  return tracksCrediting(response, artist.spotifyId).slice(0, limit)
}
