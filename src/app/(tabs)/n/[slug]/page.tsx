import { CloudOff } from "lucide-react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { ButtonLink } from "@/components/ds/button"
import {
  FeedSkeleton,
  HeroMosaic,
  LiveForYou,
  LiveSounds,
  LiveTea,
  LiveWatch,
  TopTracks,
} from "@/components/niche/feed/live-panels"
import { NicheHero } from "@/components/niche/niche-hero"
import { NicheTabs } from "@/components/niche/niche-tabs"
import { CommunitySection } from "@/components/niche/sections/community-section"
import { DripSection } from "@/components/niche/sections/drip-section"
import { ForYouSection, RelatedNiches } from "@/components/niche/sections/for-you-section"
import { MoodboardSection } from "@/components/niche/sections/moodboard-section"
import { EmptyState } from "@/components/shell/empty-state"
import { PullToRefresh } from "@/components/shell/pull-to-refresh"
import { Screen } from "@/components/shell/screen"
import { Skeleton } from "@/components/ui/skeleton"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { env } from "@/lib/env"
import { type NichePreset, findSeedProfileByName } from "@/lib/niches/catalog"
import { isNew } from "@/lib/niches/lifecycle"
import { type NicheMeta, type NicheSource, lookupNicheProfile } from "@/lib/niches/lookup"
import { nicheTheme } from "@/lib/niches/theme"

export async function generateMetadata({ params }: PageProps<"/n/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const lookup = await lookupNicheProfile(slug)
  if (lookup.status !== "found") return { title: "Niche" }
  const { profile } = lookup
  return {
    title: profile.name,
    description: profile.tagline,
    openGraph: { title: `${profile.name} · subcult`, description: profile.tagline },
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

/** Lifecycle label for DB niches; curated seeds get none. */
function trendBadge(meta: NicheMeta | null): string | null {
  if (!meta || meta.kind !== "trending") return null
  if (meta.status === "archived") return "Past trend"
  return isNew(meta.publishedAt) ? "New" : "Trending"
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
    <PullToRefresh>
      <div data-niche="" data-niche-source={source} style={theme.style}>
        <NicheHero
          profile={profile}
          themeStyle={theme.style}
          badge={trendBadge(meta)}
          mosaic={
            <Suspense fallback={null}>
              <HeroMosaic profile={profile} />
            </Suspense>
          }
        />

        <div className="container-page mt-2 md:mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-14">
          <div className="min-w-0">
            <NicheTabs
              panels={{
                "for-you": (
                  <>
                    <ForYouSection
                      profile={profile}
                      related={related}
                      sources={meta?.sources ?? []}
                    />
                    <Suspense fallback={<FeedSkeleton />}>
                      <LiveForYou profile={profile} />
                    </Suspense>
                  </>
                ),
                sounds: (
                  <Suspense fallback={<FeedSkeleton count={6} />}>
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

          <aside className="hidden lg:block">
            <div className="sticky top-8 space-y-10 pt-6">
              <section>
                <p className="mb-3 text-overline font-medium text-muted-foreground uppercase">
                  About
                </p>
                <p className="text-callout leading-relaxed text-muted-foreground">
                  {profile.description}
                </p>
              </section>
              <section>
                <p className="mb-3 text-overline font-medium text-muted-foreground uppercase">
                  Palette
                </p>
                <ul className="flex h-12 overflow-hidden rounded-xl">
                  {profile.palette.map((hex) => (
                    <li key={hex} className="flex-1" style={{ backgroundColor: hex }} title={hex} />
                  ))}
                </ul>
              </section>
              <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
                <TopTracks profile={profile} />
              </Suspense>
              {related.length > 0 ? (
                <section>
                  <p className="mb-3 text-overline font-medium text-muted-foreground uppercase">
                    You might also be into
                  </p>
                  <RelatedNiches related={related} vertical />
                </section>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </PullToRefresh>
  )
}

function NicheUnavailable() {
  return (
    <EmptyState
      icon={CloudOff}
      title="We can't reach this niche right now"
      body="The curated niches on Explore still work."
      action={<ButtonLink href="/explore">Go to Explore</ButtonLink>}
    />
  )
}

function NicheSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading niche">
      <div className="md:container-page md:pt-8">
        <Skeleton className="h-[78svh] max-h-[680px] min-h-[520px] rounded-none md:h-[440px] md:min-h-0 md:rounded-3xl" />
      </div>
      <div className="container-page mt-8 flex gap-6">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-16" />
        ))}
      </div>
      <FeedSkeleton />
    </div>
  )
}
