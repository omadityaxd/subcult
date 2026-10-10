import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import {
  FeedSkeleton,
  LiveForYou,
  LiveSounds,
  LiveTea,
  LiveWatch,
} from "@/components/niche/feed/live-panels"
import { NicheHero } from "@/components/niche/niche-hero"
import { NicheNavBar } from "@/components/niche/niche-nav-bar"
import { NicheTabs } from "@/components/niche/niche-tabs"
import { CommunitySection } from "@/components/niche/sections/community-section"
import { DripSection } from "@/components/niche/sections/drip-section"
import { ForYouSection } from "@/components/niche/sections/for-you-section"
import { MoodboardSection } from "@/components/niche/sections/moodboard-section"
import { BackButton } from "@/components/shell/back-button"
import { EmptyState } from "@/components/shell/empty-state"
import { Screen } from "@/components/shell/screen"
import { Skeleton } from "@/components/ui/skeleton"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { env } from "@/lib/env"
import { NICHE_PRESETS, type NichePreset, findSeedProfileByName } from "@/lib/niches/catalog"
import { isNew } from "@/lib/niches/lifecycle"
import { type NicheMeta, type NicheSource, lookupNicheProfile } from "@/lib/niches/lookup"
import { nicheTheme } from "@/lib/niches/theme"

export function generateStaticParams() {
  return NICHE_PRESETS.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps<"/n/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const lookup = await lookupNicheProfile(slug)
  if (lookup.status !== "found") return { title: "niche" }
  const { profile } = lookup
  return {
    title: profile.name,
    description: profile.tagline,
    openGraph: {
      title: `${profile.emoji} ${profile.name} · subcult`,
      description: profile.tagline,
    },
  }
}

/**
 * The static shell (skeleton) is prefetched and shown instantly; the
 * slug-dependent world streams in and re-themes the page from its palette.
 */
export default function NichePage({ params }: PageProps<"/n/[slug]">) {
  return (
    <Screen>
      <Suspense fallback={<NicheSkeleton />}>
        <NicheContent params={params} />
      </Suspense>
    </Screen>
  )
}

async function NicheContent({ params }: Pick<PageProps<"/n/[slug]">, "params">) {
  const { slug } = await params
  const lookup = await lookupNicheProfile(slug)
  if (lookup.status === "missing") notFound()
  if (lookup.status === "unavailable") return <NicheUnavailable />
  return <NicheWorld profile={lookup.profile} meta={lookup.meta} source={lookup.source} />
}

function NicheWorld({
  profile,
  meta,
  source,
}: {
  profile: NicheProfile
  meta: NicheMeta | null
  source: NicheSource
}) {
  const badge = trendBadge(meta)
  const theme = nicheTheme(profile.palette)
  const related = profile.relatedNiches
    .map((name) => findSeedProfileByName(name))
    .filter((match): match is NonNullable<typeof match> => match !== undefined)
    .map(({ slug, name, emoji, tagline, palette }): NichePreset => ({
      slug,
      name,
      emoji,
      tagline,
      palette,
    }))
  const shopConfig = { amazonDomain: env.AMAZON_DOMAIN, amazonTag: env.AMAZON_AFFILIATE_TAG }

  return (
    <div data-niche="" data-niche-source={source} style={theme.style}>
      <NicheNavBar name={profile.name} emoji={profile.emoji} />
      <NicheHero profile={profile} themeStyle={theme.style} badge={badge} />
      <NicheTabs
        panels={{
          "for-you": (
            <>
              <ForYouSection profile={profile} related={related} sources={meta?.sources ?? []} />
              <Suspense fallback={<FeedSkeleton />}>
                <LiveForYou profile={profile} />
              </Suspense>
            </>
          ),
          sounds: (
            <Suspense fallback={<FeedSkeleton count={4} />}>
              <LiveSounds profile={profile} />
            </Suspense>
          ),
          tea: (
            <Suspense fallback={<FeedSkeleton count={4} />}>
              <LiveTea profile={profile} />
            </Suspense>
          ),
          community: <CommunitySection profile={profile} />,
          watch: (
            <Suspense fallback={<FeedSkeleton count={3} />}>
              <LiveWatch profile={profile} />
            </Suspense>
          ),
          drip: (
            <DripSection
              brands={profile.brands}
              shopKeywords={profile.shopKeywords}
              shopConfig={shopConfig}
              themeStyle={theme.style}
            />
          ),
          moodboard: (
            <MoodboardSection
              profile={{
                palette: profile.palette,
                vibeWords: profile.vibeWords,
                pinterestQueries: profile.pinterestQueries,
                instagramHashtags: profile.instagramHashtags,
                tiktokQueries: profile.tiktokQueries,
              }}
            />
          ),
        }}
      />
    </div>
  )
}

/** Lifecycle label for DB niches; curated seeds get none. */
function trendBadge(meta: NicheMeta | null): string | null {
  if (!meta || meta.kind !== "trending") return null
  if (meta.status === "archived") return "🧊 this trend cooled off"
  return isNew(meta.publishedAt) ? "🔥 new" : "🔥 trending"
}

function NicheUnavailable() {
  return (
    <>
      <div className="flex h-(--nav-bar-height) items-center px-4 pt-safe">
        <BackButton href="/explore" label="explore" />
      </div>
      <div className="px-4 pt-4">
        <EmptyState
          emoji="😵‍💫"
          title="the vibe vault is napping"
          body="we can't reach this niche right now. the presets on explore still work."
        />
      </div>
    </>
  )
}

function NicheSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading niche">
      <div className="flex h-(--nav-bar-height) items-center px-4 pt-safe">
        <Skeleton className="size-9 rounded-full" />
      </div>
      <div className="space-y-4 px-5 pt-12">
        <Skeleton className="size-16 rounded-2xl" />
        <Skeleton className="h-10 w-2/3 rounded-xl" />
        <Skeleton className="h-5 w-5/6 rounded-lg" />
        <Skeleton className="h-11 w-44 rounded-full" />
      </div>
      <div className="mt-8 flex gap-2 px-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      <div className="mt-6 space-y-2 px-4">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
    </div>
  )
}
