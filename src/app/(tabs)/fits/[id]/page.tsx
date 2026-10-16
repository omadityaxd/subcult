import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"
import { z } from "zod"
import { getDb } from "@/db"
import { getFit } from "@/db/fit-repository"
import { canView, createSocialRepository } from "@/db/social-repository"
import { FitDetail } from "@/components/fits/fit-detail"
import { Screen } from "@/components/shell/screen"
import { Skeleton } from "@/components/ui/skeleton"
import { toViews } from "@/lib/fits/server"
import { getViewer } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Fit" }

/** A fit's own page (shareable; posting lands here). */
export default function FitPage({ params }: PageProps<"/fits/[id]">) {
  return (
    <Screen>
      <div className="container-page max-w-xl pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-16">
        <Suspense fallback={<Skeleton className="aspect-[4/5] w-full rounded-2xl" />}>
          <Fit params={params} />
        </Suspense>
      </div>
    </Screen>
  )
}

async function Fit({ params }: Pick<PageProps<"/fits/[id]">, "params">) {
  await connection()
  const { id } = await params
  const db = getDb()
  if (!db || !z.string().uuid().safeParse(id).success) notFound()
  const [row, viewer] = await Promise.all([getFit(db, id), getViewer()])
  if (!row || (row.status !== "visible" && row.userId !== viewer?.id)) notFound()
  // Friends-only owners: a direct link shows the fit only to them and mutual follows.
  const social = createSocialRepository(db)
  const [settings, relation] = await Promise.all([
    social.settings(row.userId),
    social.relation(viewer?.id ?? null, row.userId),
  ])
  if (!canView(settings.visibility, relation)) notFound()
  const [fit] = await toViews([row], viewer)
  return <FitDetail fit={fit} signedIn={viewer !== null} />
}
