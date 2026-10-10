import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { BackButton } from "@/components/shell/back-button"
import { EmptyState } from "@/components/shell/empty-state"
import { LargeTitle } from "@/components/shell/large-title"
import { Screen } from "@/components/shell/screen"
import { Skeleton } from "@/components/ui/skeleton"
import { NICHE_PRESETS, findSeedProfile } from "@/lib/niches/catalog"
import { lookupNicheProfile } from "@/lib/niches/lookup"

export function generateStaticParams() {
  return NICHE_PRESETS.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps<"/n/[slug]">): Promise<Metadata> {
  const { slug } = await params
  return { title: findSeedProfile(slug)?.name ?? "niche" }
}

/**
 * The static shell (back button + skeleton) is prefetched and shown instantly;
 * the slug-dependent content streams in. Real sections land in Phase 3.
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
  if (lookup.status === "unavailable") {
    return (
      <div className="px-4 pt-(--nav-bar-height)">
        <EmptyState
          emoji="😵‍💫"
          title="the vibe vault is napping"
          body="we can't reach this niche right now. the presets on explore still work."
        />
      </div>
    )
  }
  const niche = lookup.profile

  return (
    <>
      <LargeTitle
        title={`${niche.emoji} ${niche.name}`}
        leading={<BackButton href="/explore" label="explore" />}
      />
      <div className="px-4">
        <EmptyState
          emoji="🚧"
          title="this world is still loading"
          body="sounds, tea, community, drip and the moodboard drop here next."
        />
      </div>
    </>
  )
}

function NicheSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading niche">
      <div className="flex h-(--nav-bar-height) items-center px-4 pt-safe">
        <BackButton href="/explore" label="explore" />
      </div>
      <div className="space-y-6 px-4 pt-1">
        <Skeleton className="h-9 w-2/3 rounded-xl" />
        <Skeleton className="h-56 w-full rounded-3xl" />
      </div>
    </div>
  )
}
