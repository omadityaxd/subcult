import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { Cover } from "@/components/ds/cover"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { FollowButton } from "./follow-button"
import { ShareButton } from "./share-button"

interface NicheHeroProps {
  profile: NicheProfile
  badge?: string | null
  /** Album-art mosaic, streamed in when Spotify is available. */
  mosaic?: ReactNode
  /** Top artist photo, saved with a follow so Me can show it. */
  imageUrl?: string | null
}

/**
 * Full-bleed cover on phones, rounded banner on larger screens. The cover
 * morphs from the card that was tapped (shared view-transition name); type
 * sits on a scrim so it reads on any palette.
 */
export function NicheHero({ profile, badge, mosaic, imageUrl }: NicheHeroProps) {
  return (
    <section className="md:container-page md:pt-8">
      <Cover
        palette={profile.palette}
        seed={profile.slug}
        transitionName={`cover-${profile.slug}`}
        className="relative h-[66svh] max-h-[580px] min-h-[480px] md:h-[440px] md:min-h-0 md:rounded-3xl lg:h-[480px]"
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/10"
        />

        <Link
          href="/explore"
          transitionTypes={["nav-back"]}
          aria-label="Back to explore"
          className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] left-4 grid size-10 place-items-center rounded-full bg-black/30 text-white backdrop-blur-md transition-colors hover:bg-black/50 md:top-5 md:left-5"
        >
          <ChevronLeft aria-hidden className="size-5" strokeWidth={1.75} />
        </Link>

        {mosaic ? (
          <div className="absolute top-[calc(env(safe-area-inset-top)+4.5rem)] right-4 w-[58%] max-w-72 md:top-1/2 md:right-10 md:w-[34%] md:max-w-sm md:-translate-y-1/2">
            {mosaic}
          </div>
        ) : null}

        <div className="absolute inset-x-5 bottom-7 text-white md:right-auto md:bottom-10 md:left-10 md:max-w-[52%]">
          {badge ? (
            <span className="mb-4 inline-block rounded-full bg-white/90 px-3 py-1 text-overline font-semibold text-black uppercase">
              {badge}
            </span>
          ) : null}
          <h1 className="font-serif text-display text-balance italic drop-shadow-sm">
            {profile.name}
          </h1>
          <p className="mt-3 max-w-md text-headline text-pretty text-white/85">{profile.tagline}</p>
          <div className="mt-6 flex items-center gap-2">
            <FollowButton
              slug={profile.slug}
              name={profile.name}
              tagline={profile.tagline}
              imageUrl={imageUrl ?? null}
            />
            <ShareButton name={profile.name} slug={profile.slug} />
          </div>
        </div>
      </Cover>
    </section>
  )
}
