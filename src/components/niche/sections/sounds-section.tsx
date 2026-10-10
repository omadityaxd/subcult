import { ListMusic, Mic2 } from "lucide-react"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { spotify } from "@/lib/links"
import { LinkCard, SectionHeading } from "../link-card"

/**
 * Artists and playlists from the profile, deep-linked to Spotify search.
 * This is also the no-keys fallback; live Spotify results layer on in Phase 4.
 */
export function SoundsSection({ profile }: { profile: NicheProfile }) {
  return (
    <div className="space-y-8">
      <section>
        <SectionHeading>the artists</SectionHeading>
        <div className="space-y-2">
          {profile.artists.map((artist) => (
            <LinkCard
              key={artist.name}
              href={spotify.artistSearch(artist.name)}
              title={artist.name}
              subtitle={artist.why}
              icon={<Mic2 aria-hidden className="size-5" />}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionHeading>playlists to dig through</SectionHeading>
        <div className="grid grid-cols-2 gap-2">
          {profile.spotifyQueries.map((query) => (
            <LinkCard
              key={query}
              href={spotify.playlistSearch(query)}
              title={query}
              icon={<ListMusic aria-hidden className="size-5" />}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
