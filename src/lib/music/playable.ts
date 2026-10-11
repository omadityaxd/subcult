/** Any song the app can show: a soundtrack row, a Spotify result, an artist's top track. */
export interface PlayableTrack {
  id: string
  title: string
  artist: string
  artworkUrl: string | null
  /** Exact Spotify track or a Spotify search for it: the small secondary link. */
  spotifyUrl: string | null
  /** Known 30s preview; when missing it's looked up (exact match only) on tap. */
  previewUrl?: string | null
  appleUrl?: string | null
  niche?: string | null
}
