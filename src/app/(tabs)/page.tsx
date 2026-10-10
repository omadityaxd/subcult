import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { EmptyState } from "@/components/shell/empty-state"
import { LargeTitle } from "@/components/shell/large-title"
import { Pressable } from "@/components/shell/pressable"
import { Screen } from "@/components/shell/screen"
import { NICHE_PRESETS } from "@/lib/niches/catalog"

const TRENDING = NICHE_PRESETS.slice(0, 10)

export default function ForYouPage() {
  return (
    <Screen>
      <LargeTitle title="for you" subtitle="your niches, one feed" />
      <div className="space-y-8 px-4">
        <VibeCheckCard />

        <section aria-labelledby="trending-heading">
          <h2 id="trending-heading" className="mb-3 text-[20px] font-semibold tracking-tight">
            trending niches 🔥
          </h2>
          <ul className="-mx-4 no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">
            {TRENDING.map((niche) => (
              <li key={niche.slug} className="shrink-0">
                <Pressable scale={0.94}>
                  <Link
                    href={`/n/${niche.slug}`}
                    transitionTypes={["nav-forward"]}
                    className="flex items-center gap-1.5 rounded-full bg-card px-4 py-2.5 text-[15px] font-medium"
                  >
                    <span aria-hidden>{niche.emoji}</span>
                    {niche.name}
                  </Link>
                </Pressable>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="feed-heading">
          <h2 id="feed-heading" className="mb-3 text-[20px] font-semibold tracking-tight">
            your feed
          </h2>
          <EmptyState
            title="it's giving… nothing yet"
            body="join a niche and this fills up with sounds, tea, fits and the group chat energy."
          />
        </section>
      </div>
    </Screen>
  )
}

function VibeCheckCard() {
  return (
    <Pressable>
      <Link
        href="/vibe-check"
        transitionTypes={["nav-forward"]}
        className="bg-brand-gradient relative block overflow-hidden rounded-3xl p-5 text-white"
      >
        <div
          aria-hidden
          className="bg-brand-lime/40 absolute -top-10 -right-6 size-40 rounded-full blur-2xl"
        />
        <p className="relative text-[13px] font-semibold tracking-widest uppercase opacity-80">
          30 sec · 12 swipes
        </p>
        <p className="font-display relative mt-2 text-[28px] leading-tight font-bold">
          what&apos;s your niche, actually?
        </p>
        <p className="relative mt-1 text-[15px] opacity-90">
          swipe on vibes. we&apos;ll tell you exactly how deep you are in.
        </p>
        <span className="relative mt-5 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[15px] font-semibold text-black">
          take the vibe check <ArrowRight aria-hidden className="size-4" />
        </span>
      </Link>
    </Pressable>
  )
}
