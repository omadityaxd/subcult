import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"
import { LargeTitle } from "@/components/shell/large-title"
import { Screen } from "@/components/shell/screen"
import { ShareMatchCard } from "@/components/social/share-match-card"
import { Skeleton } from "@/components/ui/skeleton"
import { handleSchema } from "@/lib/fits/schema"
import { profileView } from "@/lib/social/server"
import { entitySlug, entityType } from "@/lib/taste/entities"

export const metadata: Metadata = { title: "Vibe match", robots: { index: false } }

/** You and them: the percent, what you share, and what they'd put you on. */
export default function MatchPage({ params }: PageProps<"/u/[handle]/match">) {
  return (
    <Screen>
      <Suspense fallback={<Skeleton className="container-page mt-20 h-96 rounded-3xl" />}>
        <Match params={params} />
      </Suspense>
    </Screen>
  )
}

async function Match({ params }: Pick<PageProps<"/u/[handle]/match">, "params">) {
  await connection()
  const { handle } = await params
  if (!handleSchema.safeParse(handle).success) notFound()
  const view = await profileView(handle)
  if (!view) notFound()
  if (!view.viewerSignedIn) redirect(`/login?next=/u/${handle}/match`)
  if (!view.match) redirect(`/u/${handle}`)
  const { match } = view
  const href = (ref: string) =>
    entityType(ref as never) === "niche" ? `/n/${entitySlug(ref as never)}` : null

  return (
    <>
      <LargeTitle overline={`You × @${view.handle}`} title="Vibe match" />
      <div className="container-page max-w-2xl space-y-10 pb-16">
        <p className="font-serif text-[96px] leading-none italic tabular-nums">{match.percent}%</p>

        {match.sharedNiches.length + match.sharedArtists.length + match.sharedBrands.length > 0 ? (
          <section>
            <h2 className="mb-3 text-overline font-medium text-muted-foreground uppercase">
              You both love
            </h2>
            <ul className="flex flex-wrap gap-2">
              {[...match.sharedNiches, ...match.sharedArtists, ...match.sharedBrands].map(
                (entity) => {
                  const link = href(entity.ref)
                  const chip =
                    "inline-flex h-10 items-center rounded-full border border-border-strong px-4 text-footnote font-semibold"
                  return (
                    <li key={entity.ref}>
                      {link ? (
                        <Link href={link} className={chip}>
                          {entity.label}
                        </Link>
                      ) : (
                        <span className={chip}>{entity.label}</span>
                      )}
                    </li>
                  )
                },
              )}
            </ul>
          </section>
        ) : (
          <p className="text-callout text-muted-foreground">
            Nothing in common yet. That&apos;s what friends are for.
          </p>
        )}

        {match.putYouOn ? (
          <section className="rounded-3xl bg-card p-5">
            <h2 className="text-overline font-medium text-muted-foreground uppercase">
              @{view.handle} would put you on
            </h2>
            <p className="mt-2 font-serif text-title-1 italic">{match.putYouOn.label}</p>
          </section>
        ) : null}

        <ShareMatchCard handle={view.handle} percent={match.percent} />
        <p className="text-caption text-muted-foreground">
          From what you both play, save and follow on subcult. Taste you reset doesn&apos;t count.
        </p>
      </div>
    </>
  )
}
