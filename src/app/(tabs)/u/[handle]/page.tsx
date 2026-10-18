import { Lock, Music2 } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"
import { FitGrid } from "@/components/fits/fit-tile"
import { MediaImage } from "@/components/ds/media-image"
import { FollowButton, ProfileMenu } from "@/components/social/follow-button"
import { LargeTitle } from "@/components/shell/large-title"
import { Screen } from "@/components/shell/screen"
import { Skeleton } from "@/components/ui/skeleton"
import { handleSchema } from "@/lib/fits/schema"
import { profileView } from "@/lib/social/server"

export async function generateMetadata({ params }: PageProps<"/u/[handle]">): Promise<Metadata> {
  const { handle } = await params
  return { title: `@${handle}`, robots: { index: false } }
}

/** A person: fits, top niches, what they're playing (opt-in), and your vibe match. */
export default function ProfilePage({ params }: PageProps<"/u/[handle]">) {
  return (
    <Screen>
      <Suspense fallback={<ProfileSkeleton />}>
        <Profile params={params} />
      </Suspense>
    </Screen>
  )
}

async function Profile({ params }: Pick<PageProps<"/u/[handle]">, "params">) {
  await connection()
  const { handle } = await params
  if (!handleSchema.safeParse(handle).success) notFound()
  const view = await profileView(handle)
  if (!view) notFound()
  const { relation } = view

  return (
    <>
      <LargeTitle
        overline={view.visibility === "friends" ? "Friends-only profile" : "Profile"}
        title={`@${view.handle}`}
      />
      <div className="container-page space-y-10 pb-16">
        {view.foundingNo ? (
          <p className="inline-flex items-center gap-2 rounded-full border border-border-strong px-3 py-1 text-caption font-semibold tracking-[0.15em] uppercase">
            Founding 50 · No. {String(view.foundingNo).padStart(2, "0")}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-callout text-muted-foreground tabular-nums">
            <span className="font-semibold text-foreground">{view.counts.followers}</span>{" "}
            {view.counts.followers === 1 ? "follower" : "followers"} ·{" "}
            <span className="font-semibold text-foreground">{view.counts.following}</span> following
          </p>
          {relation.self ? (
            <Link
              href="/me#friends"
              className="ml-auto h-10 rounded-full border border-border-strong px-4 text-footnote leading-10 font-semibold"
            >
              Edit profile
            </Link>
          ) : (
            <div className="ml-auto flex items-center gap-2">
              <FollowButton
                handle={view.handle}
                following={relation.following}
                signedIn={view.viewerSignedIn}
              />
              {view.viewerSignedIn ? <ProfileMenu handle={view.handle} /> : null}
            </div>
          )}
        </div>

        {!view.visible ? (
          <div className="rounded-2xl border border-dashed border-border-strong p-8 text-center">
            <Lock aria-hidden className="mx-auto size-5 text-subtle" strokeWidth={1.75} />
            <p className="mt-3 font-serif text-title-3 italic">Friends only</p>
            <p className="mt-2 text-callout text-muted-foreground">
              Follow @{view.handle}. When they follow you back, you&apos;ll see their fits and
              taste.
            </p>
          </div>
        ) : (
          <>
            {view.match ? (
              <Link
                href={`/u/${view.handle}/match`}
                className="flex items-center justify-between gap-4 rounded-3xl bg-card p-5 transition-transform active:scale-[0.99]"
              >
                <span>
                  <span className="block text-overline font-medium text-muted-foreground uppercase">
                    Vibe match
                  </span>
                  <span className="mt-1 block font-serif text-title-1 italic tabular-nums">
                    {view.match.percent}%
                  </span>
                </span>
                <span className="text-footnote font-semibold">See why →</span>
              </Link>
            ) : null}

            {view.listening ? (
              <div className="flex items-center gap-3 rounded-2xl bg-card p-3">
                <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                  {view.listening.artworkUrl ? (
                    <MediaImage src={view.listening.artworkUrl} alt="" sizes="48px" />
                  ) : (
                    <Music2 aria-hidden className="size-5" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-caption text-muted-foreground">Playing now</span>
                  <span className="block truncate text-callout font-semibold">
                    {view.listening.title}
                  </span>
                  <span className="block truncate text-footnote text-muted-foreground">
                    {view.listening.artist}
                  </span>
                </span>
              </div>
            ) : null}

            {view.topNiches.length > 0 ? (
              <section>
                <h2 className="mb-3 text-overline font-medium text-muted-foreground uppercase">
                  Top niches right now
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {view.topNiches.map((niche) => (
                    <li key={niche.slug}>
                      <Link
                        href={`/n/${niche.slug}`}
                        className="inline-flex h-10 items-center rounded-full border border-border-strong px-4 text-footnote font-semibold"
                      >
                        {niche.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section>
              <h2 className="mb-3 text-overline font-medium text-muted-foreground uppercase">
                Fits
              </h2>
              {view.fits.length > 0 ? (
                <FitGrid fits={view.fits} signedIn={view.viewerSignedIn} />
              ) : (
                <p className="rounded-2xl border border-dashed border-border-strong p-8 text-center text-callout text-muted-foreground">
                  No fits posted yet.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </>
  )
}

function ProfileSkeleton() {
  return (
    <div className="container-page space-y-6 pt-20">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-24 w-full rounded-3xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Skeleton className="aspect-[4/5] rounded-2xl" />
        <Skeleton className="aspect-[4/5] rounded-2xl" />
        <Skeleton className="hidden aspect-[4/5] rounded-2xl sm:block" />
      </div>
    </div>
  )
}
