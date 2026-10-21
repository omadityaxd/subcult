import type { Metadata } from "next"
import Link from "next/link"
import { LegalLinks } from "@/components/shell/legal-links"
import { Screen } from "@/components/shell/screen"

export const metadata: Metadata = {
  title: "About",
  description:
    "subcult is a daily magazine for your subculture: a new numbered issue every day with the tea, fits, grails, sounds and what's rising in your scenes.",
}

/** subcult in three lines. */
export default function AboutPage() {
  return (
    <Screen>
      <article className="container-page max-w-2xl py-10 md:py-16">
        <p className="font-serif text-[30px] leading-none italic">subcult</p>
        <div className="mt-10 space-y-4 font-serif text-title-1 leading-tight text-balance italic md:text-[40px]">
          <p>A new issue of your subculture&apos;s magazine, every day.</p>
          <p>The tea, the fits, the grails, the sounds and what&apos;s rising in your scenes.</p>
          <p>Swipe a vibe check, and it learns which scenes are yours.</p>
        </div>
        <div className="mt-10 flex flex-wrap gap-2">
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-full bg-foreground px-5 text-callout font-semibold text-background"
          >
            Read today&apos;s issue
          </Link>
          <Link
            href="/vibe-check"
            className="inline-flex h-11 items-center rounded-full border border-border-strong px-5 text-callout font-semibold"
          >
            Take the vibe check
          </Link>
        </div>
        <LegalLinks className="mt-12" />
      </article>
    </Screen>
  )
}
