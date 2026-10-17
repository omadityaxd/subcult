import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
import { Screen } from "@/components/shell/screen"
import { NICHE_PRESETS } from "@/lib/niches/catalog"
import { authEnabled, getViewer } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Set up your feed", robots: { index: false } }

const SLUG = /^[a-z0-9-]{1,64}$/

/** Setup after the vibe check: /start?mix=rage,vamp,jerk pre-selects the result. */
export default function StartPage({ searchParams }: PageProps<"/start">) {
  return (
    <Screen>
      <Suspense fallback={null}>
        <Start searchParams={searchParams} />
      </Suspense>
    </Screen>
  )
}

async function Start({ searchParams }: Pick<PageProps<"/start">, "searchParams">) {
  await connection()
  const { mix } = await searchParams
  const preselected = (typeof mix === "string" ? mix.split(",") : []).filter((s) => SLUG.test(s))
  const viewer = authEnabled ? await getViewer() : null
  return (
    <OnboardingFlow presets={NICHE_PRESETS} preselected={preselected} signedIn={viewer !== null} />
  )
}
