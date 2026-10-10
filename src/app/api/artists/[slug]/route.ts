import { cached } from "@/lib/feed/cache"
import { errorMessage, log } from "@/lib/log"
import { type ArtistTrack, findArtistTracks } from "@/lib/music/artist-tracks"
import { getCacheStore, getSpotify } from "@/lib/music/server"
import { TAXONOMY, findPreset } from "@/lib/niches/catalog"
import { apiError, apiOk } from "@/lib/request"

export interface ArtistSheetData {
  artist: { slug: string; name: string; imageUrl: string | null; spotifyUrl: string }
  /** Empty when Spotify is unavailable; the sheet still links out. */
  tracks: ArtistTrack[]
  niches: { slug: string; name: string; palette: readonly string[]; imageUrl: string | null }[]
}

const TRACKS_POLICY = { freshSeconds: 24 * 3600, staleSeconds: 14 * 24 * 3600 }

/** GET /api/artists/:slug → a verified artist with top tracks and the niches they belong to. */
export async function GET(_request: Request, ctx: RouteContext<"/api/artists/[slug]">) {
  const { slug } = await ctx.params
  const artist = TAXONOMY.artist(slug)
  if (!artist) return apiError("no such artist", 404, "invalid-input")

  let tracks: ArtistTrack[] = []
  const spotify = getSpotify()
  if (spotify) {
    try {
      const result = await cached(
        getCacheStore(),
        `subcult:artist-tracks:v1:${artist.spotifyId}`,
        TRACKS_POLICY,
        () => findArtistTracks(spotify, artist),
      )
      tracks = result.value
    } catch (error) {
      // Rate-limited or down: the sheet still shows the artist and links out.
      log.warn("api.artists.tracks_failed", { slug, error: errorMessage(error) })
    }
  }

  const niches = TAXONOMY.nichesOfArtist(slug).flatMap((niche) => {
    const preset = findPreset(niche)
    return preset
      ? [
          {
            slug: preset.slug,
            name: preset.name,
            palette: preset.palette,
            imageUrl: preset.imageUrl,
          },
        ]
      : []
  })

  return apiOk<ArtistSheetData>({
    artist: {
      slug: artist.slug,
      name: artist.name,
      imageUrl: artist.imageUrl,
      spotifyUrl: `https://open.spotify.com/artist/${artist.spotifyId}`,
    },
    tracks,
    niches,
  })
}
