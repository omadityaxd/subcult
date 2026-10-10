import { SectionHeader } from "@/components/ds/section-header"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { spotify } from "@/lib/links"
import { LinkList } from "../link-card"

/** No-keys fallback: curated artists and playlist searches, deep-linked to Spotify. */
export function SoundsSection({ profile }: { profile: NicheProfile }) {
  return (
    <div className="space-y-12">
      <section>
        <SectionHeader overline="The canon" title="Artists" />
        <LinkList
          links={profile.artists.map((artist) => ({
            title: artist.name,
            href: spotify.artistSearch(artist.name),
            meta: artist.why,
          }))}
        />
      </section>
      <section>
        <SectionHeader title="Playlists to dig through" />
        <LinkList
          links={profile.spotifyQueries.map((query) => ({
            title: query,
            href: spotify.playlistSearch(query),
            meta: "Spotify playlists",
          }))}
        />
      </section>
    </div>
  )
}
