import { Mic2, Newspaper } from "lucide-react"
import Link from "next/link"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import type { NichePreset } from "@/lib/niches/catalog"
import type { TrendSource } from "@/lib/niches/lifecycle"
import { spotify } from "@/lib/links"
import { LinkCard, SectionHeading } from "../link-card"

interface ForYouSectionProps {
  profile: NicheProfile
  related: readonly NichePreset[]
  /** Evidence for trending niches (empty for evergreen ones). */
  sources: readonly TrendSource[]
}

const STARTER_ARTISTS = 3

/** The niche at a glance: what it is, its vibe, where to start, where to go next. */
export function ForYouSection({ profile, related, sources }: ForYouSectionProps) {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-[17px] leading-relaxed">{profile.description}</p>
        <ul aria-label="Vibe words" className="mt-4 flex flex-wrap gap-2">
          {profile.vibeWords.map((word) => (
            <li key={word} className="rounded-full bg-niche/15 px-3 py-1 text-[14px] text-niche">
              {word}
            </li>
          ))}
        </ul>
      </section>

      {sources.length > 0 ? (
        <section>
          <SectionHeading>why it&apos;s trending 📈</SectionHeading>
          <div className="space-y-2">
            {sources.map((source) => (
              <LinkCard
                key={source.url}
                href={source.url}
                title={source.title}
                subtitle={new URL(source.url).hostname.replace(/^www./, "")}
                icon={<Newspaper aria-hidden className="size-5" />}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeading>start here 🎧</SectionHeading>
        <div className="space-y-2">
          {profile.artists.slice(0, STARTER_ARTISTS).map((artist) => (
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

      {related.length > 0 ? (
        <section>
          <SectionHeading>you might also be into</SectionHeading>
          <ul className="-mx-4 no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">
            {related.map((niche) => (
              <li key={niche.slug} className="shrink-0">
                <Link
                  href={`/n/${niche.slug}`}
                  transitionTypes={["nav-forward"]}
                  className="flex items-center gap-1.5 rounded-full bg-card px-4 py-2.5 text-[15px] font-medium transition-transform active:scale-95"
                >
                  <span aria-hidden>{niche.emoji}</span>
                  {niche.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
