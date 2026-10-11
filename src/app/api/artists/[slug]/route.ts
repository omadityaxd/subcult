import type { PlayableTrack } from "@/lib/music/playable"
import { cached } from "@/lib/feed/cache"
import { errorMessage, log } from "@/lib/log"
import { type ArtistTrack, findArtistTracks } from "@/lib/music/artist-tracks"
import { normalizeTitle } from "@/lib/music/itunes"
import { cachedArtistSongs } from "@/lib/music/preview-server"
import { getCacheStore, getSpotify } from "@/lib/music/server"
import { spotifySearchUrl } from "@/lib/music/soundtrack"
import { TAXONOMY, findPreset } from "@/lib/niches/catalog"
import { apiError, apiOk } from "@/lib/request"

export interface ArtistSheetData {
  artist: { slug: string; name: string; imageUrl: string | null; spotifyUrl: string }
  /** Playable here (30s previews); empty when no previews could be matched. */
  tracks: PlayableTrack[]
  /** Artists who share the most niches with this one. */
  related: { slug: string; name: string; imageUrl: string | null }[]
  niches: { slug: string; name: string; palette: readonly string[]; imageUrl: string | null }[]
}

const TOP_TRACKS = 5
const RELATED = 8
const TRACKS_POLICY = { freshSeconds: 24 * 3600, staleSeconds: 14 * 24 * 3600 }

/** Exact Spotify links for the songs, when Spotify answers; search links otherwise. */
async function spotifyTracks(artist: { slug: string; name: string; spotifyId: string }) {
  const spotify = getSpotify()
  if (!spotify) return []
  try {
    const result = await cached(
      getCacheStore(),
      `subcult:artist-tracks:v1:${artist.spotifyId}`,
      TRACKS_POLICY,
      () => findArtistTracks(spotify, artist),
    )
    return result.value
  } catch (error) {
    log.warn("api.artists.spotify_failed", { slug: artist.slug, error: errorMessage(error) })
    return [] as ArtistTrack[]
  }
}

function relatedArtists(slug: string): ArtistSheetData["related"] {
  const shared = new Map<string, number>()
  for (const niche of TAXONOMY.nichesOfArtist(slug)) {
    for (const other of TAXONOMY.artistsOf(niche)) {
      if (other.slug !== slug) shared.set(other.slug, (shared.get(other.slug) ?? 0) + 1)
    }
  }
  return [...shared]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .slice(0, RELATED)
    .flatMap(([other]) => {
      const artist = TAXONOMY.artist(other)
      return artist ? [{ slug: artist.slug, name: artist.name, imageUrl: artist.imageUrl }] : []
    })
}

/** GET /api/artists/:slug → a verified artist with playable top tracks, related artists and niches. */
export async function GET(_request: Request, ctx: RouteContext<"/api/artists/[slug]">) {
  const { slug } = await ctx.params
  const artist = TAXONOMY.artist(slug)
  if (!artist) return apiError("no such artist", 404, "invalid-input")

  const [songs, onSpotify] = await Promise.all([
    cachedArtistSongs(artist.name, TOP_TRACKS).catch((error: unknown) => {
      log.warn("api.artists.previews_failed", { slug, error: errorMessage(error) })
      return []
    }),
    spotifyTracks(artist),
  ])
  const exact = new Map(onSpotify.map((track) => [normalizeTitle(track.title), track.url]))
  const tracks: PlayableTrack[] = songs.map((song) => ({
    id: `preview:${song.previewUrl}`,
    title: song.title,
    artist: song.artist,
    artworkUrl: song.artworkUrl,
    previewUrl: song.previewUrl,
    appleUrl: song.appleUrl,
    spotifyUrl: exact.get(normalizeTitle(song.title)) ?? spotifySearchUrl(song.title, song.artist),
  }))

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
    related: relatedArtists(slug),
    niches,
  })
}
