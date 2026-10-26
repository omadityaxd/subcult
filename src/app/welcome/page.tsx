import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"
import { HandleForm } from "@/app/(tabs)/fits/new/handle-form"
import { Screen } from "@/components/shell/screen"
import { getDb } from "@/db"
import { getProfile } from "@/db/fit-repository"
import { safeNext } from "@/lib/auth/redirect"
import { getViewer } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Welcome", robots: { index: false } }

/** Step markers for the first-run path (handle → vibe check → niches → first issue). */
const STEPS = ["Handle", "Vibe check", "Niches", "Your first issue"] as const

/**
 * First sign-in: pick a handle, then the vibe check (unless sign-in was on
 * the way somewhere specific, which wins).
 */
export default function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  return (
    <Screen withTabBar={false} className="grid min-h-dvh place-items-center px-6">
      <Suspense fallback={null}>
        <Welcome searchParams={searchParams} />
      </Suspense>
    </Screen>
  )
}

async function Welcome({ searchParams }: Pick<PageProps<"/welcome">, "searchParams">) {
  await connection()
  const params = await searchParams
  const next = safeNext(typeof params.next === "string" ? params.next : null, "/")
  const viewer = await getViewer()
  if (!viewer) redirect(`/login?next=${encodeURIComponent("/welcome")}`)
  const db = getDb()
  const profile = db ? await getProfile(db, viewer.id) : null
  // A handle already: a returning sign-in, so straight to where they were going.
  if (profile || !db) redirect(next)
  return (
    <div className="w-full max-w-sm py-16">
      <p className="font-serif text-[30px] leading-none italic">subcult</p>
      <ol className="mt-8 flex flex-wrap gap-x-3 gap-y-1 text-caption text-muted-foreground">
        {STEPS.map((step, i) => (
          <li key={step} className={i === 0 ? "font-semibold text-foreground" : undefined}>
            {String(i + 1).padStart(2, "0")} {step}
          </li>
        ))}
      </ol>
      <h1 className="mt-6 font-serif text-title-1 italic">Pick your handle</h1>
      <div className="mt-4">
        {/* First sign-in continues: handle → vibe check → niches → a fresh personal issue. */}
        <HandleForm
          intro="It's how friends find you and how your fits are credited. Never your email."
          next="/vibe-check?first=1"
        />
      </div>
    </div>
  )
}
