import { CloudOff } from "lucide-react"
import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { Suspense } from "react"
import { ButtonLink } from "@/components/ds/button"
import {
  ArchiveGrails,
  FeedSkeleton,
  LiveArchive,
  HeroMosaic,
  LiveForYou,
  LiveSounds,
  LiveTea,
  LiveWatch,
  NicheSoundtrack,
  TopTracks,
} from "@/components/niche/feed/live-panels"
import { ArtistsRow } from "@/components/niche/artists-row"
import {
  AdjacentNiches,
  GoDeeper,
  NicheTrail,
  SceneCommunities,
  TwoHops,
} from "@/components/niche/graph-sections"
import { NicheHero } from "@/components/niche/niche-hero"
import { NicheVisit } from "@/components/wrapped/trackers"
import { NicheTabs } from "@/components/niche/niche-tabs"
import { CommunitySection } from "@/components/niche/sections/community-section"
import { DripSection } from "@/components/niche/sections/drip-section"
import { ForYouSection } from "@/components/niche/sections/for-you-section"
import { LiveMoodboard } from "@/components/moodboard/live-moodboard"
import { TintRoot } from "@/components/niche/tint-root"
import { EmptyState } from "@/components/shell/empty-state"
import { PullToRefresh } from "@/components/shell/pull-to-refresh"
import { Screen } from "@/components/shell/screen"
import { Skeleton } from "@/components/ui/skeleton"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { env } from "@/lib/env"
import { TAXONOMY, nicheImage } from "@/lib/niches/catalog"
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
  if (lookup.status === "missing") {
    // Aliases ("/n/opium-fashion") and hubs ("/n/underground") have a canonical home.
    const canonical = TAXONOMY.resolve(slug)
    const node = canonical ? TAXONOMY.node(canonical) : undefined
    if (node?.type === "niche" && canonical !== slug) permanentRedirect(`/n/${canonical}`)
    if (node?.type === "hub") permanentRedirect(`/explore/${canonical}`)
    notFound()
  }
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
  const shopConfig = { amazonDomain: env.AMAZON_DOMAIN, amazonTag: env.AMAZON_AFFILIATE_TAG }
  const curation = TAXONOMY.curation(profile.slug)
  const brandSites = Object.fromEntries(
    profile.brands.flatMap((brand) => {
      const node = TAXONOMY.resolve(brand.name, "brand")
      const known = TAXONOMY.brandsOf(profile.slug).find((b) => b.slug === node)
      return known ? [[brand.name, known.officialUrl]] : []
    }),
  )
  const brandSlugs = Object.fromEntries(
    profile.brands.flatMap((brand) => {
      const node = TAXONOMY.resolve(brand.name, "brand")
      return node && TAXONOMY.brand(node) ? [[brand.name, node]] : []
    }),
  )
  const artists = TAXONOMY.artistsOf(profile.slug).map(({ slug, name, imageUrl }) => ({
    slug,
    name,
    imageUrl,
  }))

  return (
    <PullToRefresh>
      <TintRoot slug={profile.slug} baseStyle={theme.style} source={source}>
        <NicheHero
          profile={profile}
          imageUrl={nicheImage(profile.slug)}
          badge={trendBadge(meta)}
          mosaic={
            <Suspense fallback={null}>
              <HeroMosaic profile={profile} />
            </Suspense>
          }
        />

        <Suspense fallback={null}>
          <NicheSoundtrack slug={profile.slug} />
        </Suspense>
        <NicheVisit slug={profile.slug} />

        <div className="container-page mt-5 space-y-5 empty:hidden md:mt-8">
          <NicheTrail slug={profile.slug} />
          <GoDeeper slug={profile.slug} />
        </div>

        <div className="container-page mt-2 md:mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-14">
          <div className="min-w-0">
            <NicheTabs
              initialTab={
                TAXONOMY.branchOf(profile.slug) === "underground-fashion" ? "fits" : "for-you"
              }
              panels={{
                "for-you": (
                  <>
                    <ForYouSection profile={profile} sources={meta?.sources ?? []} />
                    <div className="mt-10 space-y-10">
                      <ArtistsRow artists={artists} themeStyle={theme.style} />
                      <AdjacentNiches slug={profile.slug} />
                      <SceneCommunities slug={profile.slug} className="lg:hidden" />
                      <div className="lg:hidden">
                        <TwoHops slug={profile.slug} />
                      </div>
                    </div>
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
                fits: (
                  <div className="space-y-12">
                    <Suspense fallback={<FeedSkeleton count={3} />}>
                      <ArchiveGrails profile={profile} />
                    </Suspense>
                    <DripSection
                      brands={profile.brands}
                      shopKeywords={profile.shopKeywords}
                      shopConfig={shopConfig}
                      themeStyle={theme.style}
                      extraStores={curation?.extraStores}
                      brandSites={brandSites}
                      brandSlugs={brandSlugs}
                    />
                  </div>
                ),
                archive: (
                  <Suspense fallback={<FeedSkeleton count={6} />}>
                    <LiveArchive profile={profile} />
                  </Suspense>
                ),
                scene: (
                  <div className="space-y-12">
                    <Suspense fallback={<FeedSkeleton count={3} />}>
                      <LiveWatch profile={profile} />
                    </Suspense>
                    <Suspense fallback={<FeedSkeleton count={4} />}>
                      <LiveTea profile={profile} />
                    </Suspense>
                    <CommunitySection profile={profile} />
                  </div>
                ),
                moodboard: (
                  <Suspense fallback={<FeedSkeleton count={6} />}>
                    <LiveMoodboard profile={profile} />
                  </Suspense>
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
              <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
                <TopTracks profile={profile} />
              </Suspense>
              <SceneCommunities slug={profile.slug} />
              <TwoHops slug={profile.slug} vertical />
            </div>
          </aside>
        </div>
      </TintRoot>
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
