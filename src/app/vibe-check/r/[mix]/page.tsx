import { X } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { Screen } from "@/components/shell/screen"
import { Skeleton } from "@/components/ui/skeleton"
import { VibeResult } from "@/components/vibe/vibe-result"
import { describeMix, isCuratedNiche, vibeTemplateBlurb } from "@/lib/vibe/data"
import { decodeMix } from "@/lib/vibe/score"

function resolve(segment: string) {
  const mix = decodeMix(segment, isCuratedNiche)
  return mix ? describeMix(mix) : null
}

export async function generateMetadata({
  params,
}: PageProps<"/vibe-check/r/[mix]">): Promise<Metadata> {
  const mix = resolve((await params).mix)
  if (!mix) return { title: "Vibe check" }
  const headline = `${mix[0].percent}% ${mix[0].name}`
  const description = mix.map((niche) => `${niche.percent}% ${niche.name}`).join(" · ")
  return {
    title: `${headline} · vibe check`,
    description,
    openGraph: { title: `${headline} · subcult vibe check`, description },
    twitter: {
      card: "summary_large_image",
      title: `${headline} · subcult vibe check`,
      description,
    },
  }
}

/** A shared result: the same hero, read-only, with "take your own" as the CTA. */
export default function SharedVibePage({ params }: PageProps<"/vibe-check/r/[mix]">) {
  return (
    <Screen withTabBar={false}>
      <Suspense fallback={<Skeleton className="h-[30rem] rounded-none md:m-8 md:rounded-3xl" />}>
        <SharedResult params={params} />
      </Suspense>
    </Screen>
  )
}

async function SharedResult({ params }: Pick<PageProps<"/vibe-check/r/[mix]">, "params">) {
  const mix = resolve((await params).mix)
  if (!mix) notFound()
  return (
    <VibeResult
      mix={mix}
      blurb={vibeTemplateBlurb(mix)}
      shared
      corner={
        <Link
          href="/"
          aria-label="Close"
          className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] right-4 z-10 grid size-10 place-items-center rounded-full bg-black/30 text-white backdrop-blur-md md:top-12 md:right-[calc(var(--gutter)+1rem)]"
        >
          <X aria-hidden className="size-5" strokeWidth={1.5} />
        </Link>
      }
    />
  )
}
