import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"
import { getDb } from "@/db"
import { getProfile } from "@/db/fit-repository"
import { LargeTitle } from "@/components/shell/large-title"
import { Screen } from "@/components/shell/screen"
import { Skeleton } from "@/components/ui/skeleton"
import { TAXONOMY, findPreset } from "@/lib/niches/catalog"
import { postingEnabled } from "@/lib/supabase/admin"
import { getViewer } from "@/lib/supabase/server"
import { HandleForm } from "./handle-form"
import { PostFitForm } from "./post-fit-form"

export const metadata: Metadata = { title: "Post your fit", robots: { index: false } }

export default function PostFitPage() {
  return (
    <Screen>
      <LargeTitle overline="Share the look" title="Post your fit" />
      <div className="container-page max-w-2xl pb-16">
        <Suspense fallback={<Skeleton className="aspect-[4/5] w-full rounded-3xl" />}>
          <PostFit />
        </Suspense>
      </div>
    </Screen>
  )
}

async function PostFit() {
  await connection()
  if (!postingEnabled()) {
    return <p className="text-callout text-muted-foreground">Posting opens soon.</p>
  }
  const viewer = await getViewer()
  if (!viewer) redirect("/login?next=/fits/new")
  const db = getDb()
  const profile = db ? await getProfile(db, viewer.id) : null
  if (!profile) return <HandleForm />

  // Fashion niches first: that's what people post fits to.
  const niches = TAXONOMY.featured()
    .concat(TAXONOMY.hubs.flatMap((hub) => hub.children))
    .filter((slug, i, all) => all.indexOf(slug) === i && findPreset(slug))
    .sort(
      (a, b) =>
        Number(TAXONOMY.branchOf(b) === "underground-fashion") -
        Number(TAXONOMY.branchOf(a) === "underground-fashion"),
    )
    .map((slug) => ({ slug, name: findPreset(slug)?.name ?? slug }))
  const brands = TAXONOMY.allBrands()
    .map((brand) => ({
      slug: brand.slug,
      name: brand.name,
      niches: TAXONOMY.nichesOfBrand(brand.slug),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return <PostFitForm handle={profile.handle} niches={niches} brands={brands} />
}
