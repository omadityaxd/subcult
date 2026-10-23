import { ExternalChips } from "@/components/ds/external-chips"
import { SectionHeader } from "@/components/ds/section-header"
import { ArtistList, type ArtistRef } from "@/components/niche/artists-row"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { spotify } from "@/lib/links"

/**
 * Sounds before the soundtrack is ready: the scene's verified artists, each
 * opening the in-app artist sheet with playable top tracks. Spotify searches
 * stay a small secondary row.
 */
export function SoundsSection({
  profile,
  artists,
}: {
  profile: NicheProfile
  artists: readonly ArtistRef[]
}) {
  const why = new Map(profile.artists.map((a) => [a.name.toLowerCase(), a.why]))
  return (
    <div className="space-y-12">
      {artists.length > 0 ? (
        <section>
          <SectionHeader overline="The canon" title="Artists" />
          <ArtistList
            artists={artists.map((artist) => ({
              ...artist,
              why: why.get(artist.name.toLowerCase()) ?? null,
            }))}
          />
        </section>
      ) : null}
      <ExternalChips
        label="Search Spotify"
        links={profile.spotifyQueries.map((query) => ({
          title: query,
          href: spotify.playlistSearch(query),
          site: "Spotify",
        }))}
      />
    </div>
  )
}
