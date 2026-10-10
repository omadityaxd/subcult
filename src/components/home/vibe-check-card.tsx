import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { Cover } from "@/components/ds/cover"

const VIBE_PALETTE = ["#0f0d17", "#3b2a6b", "#b14b8a", "#e89a6b", "#f3e6d8"]

/** Editorial promo for the onboarding quiz. */
export function VibeCheckCard() {
  return (
    <Link href="/vibe-check" transitionTypes={["nav-forward"]} className="group block">
      <Cover
        palette={VIBE_PALETTE}
        seed="vibe-check"
        className="relative flex min-h-64 flex-col justify-end rounded-3xl p-6 text-white transition-transform duration-300 group-active:scale-[0.99] md:min-h-72 md:p-10"
      >
        <span
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"
        />
        <span className="relative text-overline font-medium text-white/70 uppercase">
          30 seconds · 12 swipes
        </span>
        <span className="relative mt-3 max-w-xl font-serif text-title-1 text-balance italic">
          What&apos;s your niche, actually?
        </span>
        <span className="relative mt-6 inline-flex h-11 w-fit items-center gap-2 rounded-full bg-white px-5 text-callout font-semibold text-black transition-transform group-hover:translate-x-0.5">
          Take the vibe check <ArrowRight aria-hidden className="size-4" strokeWidth={1.75} />
        </span>
      </Cover>
    </Link>
  )
}
