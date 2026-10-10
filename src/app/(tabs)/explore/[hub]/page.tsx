import { ChevronLeft } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Cover } from "@/components/ds/cover"
import { SectionHeader } from "@/components/ds/section-header"
import { HubCard, HubCollage, hubSummary } from "@/components/explore/hub-card"
import { NicheCard } from "@/components/niche/niche-card"
import { Screen } from "@/components/shell/screen"
import { TAXONOMY, findPreset } from "@/lib/niches/catalog"
import { hubSections, rootHubs } from "@/lib/taxonomy/hubs"

export function generateStaticParams() {
  return rootHubs(TAXONOMY).map((hub) => ({ hub }))
}

export async function generateMetadata({ params }: PageProps<"/explore/[hub]">): Promise<Metadata> {
  const { hub } = await params
  const summary = hubSummary(hub)
  return summary ? { title: summary.name, description: summary.description } : { title: "Hub" }
}

/** A hub, browsed branch by branch (Music, Internet Culture, Fashion & Aesthetics…). */
export default async function HubPage({ params }: PageProps<"/explore/[hub]">) {
  const { hub } = await params
  const summary = rootHubs(TAXONOMY).includes(hub) ? hubSummary(hub) : null
  if (!summary) notFound()
  const sections = hubSections(TAXONOMY, hub)
  const otherHubs = rootHubs(TAXONOMY)
    .filter((slug) => slug !== hub)
    .flatMap((slug) => {
      const other = hubSummary(slug)
      return other ? [other] : []
    })

  return (
    <Screen>
      <section className="md:container-page md:pt-8">
        <Cover
          palette={summary.palette}
          seed={`hub-${summary.slug}`}
          className="relative flex min-h-[26rem] flex-col justify-end p-6 pt-[calc(env(safe-area-inset-top)+5rem)] text-white md:min-h-[24rem] md:rounded-3xl md:p-10 md:pt-24"
        >
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/20 md:rounded-3xl"
          />
          <Link
            href="/explore"
            transitionTypes={["nav-back"]}
            aria-label="Back to explore"
            className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] left-4 grid size-10 place-items-center rounded-full bg-black/30 text-white backdrop-blur-md transition-colors hover:bg-black/50 md:top-5 md:left-5"
          >
            <ChevronLeft aria-hidden className="size-5" strokeWidth={1.75} />
          </Link>
          <HubCollage
            images={summary.images}
            className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] right-4 md:top-8 md:right-10"
          />
          <p className="relative text-overline font-medium text-white/70 uppercase">
            Hub · {summary.nicheCount} niches
          </p>
          <h1 className="relative mt-2 max-w-2xl font-serif text-display text-balance italic">
            {summary.name}
          </h1>
          <p className="relative mt-3 max-w-xl text-headline text-pretty text-white/85">
            {summary.description}
          </p>
          {summary.branches.length > 0 ? (
            <nav aria-label="Branches" className="relative mt-6 flex flex-wrap gap-2">
              {sections.map((section) => (
                <a
                  key={section.slug}
                  href={`#${section.slug}`}
                  className="inline-flex h-10 items-center rounded-full bg-white/15 px-4 text-callout font-medium backdrop-blur-md transition-colors hover:bg-white/25"
                >
                  {section.name}
                </a>
              ))}
            </nav>
          ) : null}
        </Cover>
      </section>

      <div className="container-page mt-10 space-y-14">
        {sections.map((section) => (
          <section key={section.slug} id={section.slug} className="scroll-mt-20">
            {summary.branches.length > 0 ? (
              <header className="mb-5 max-w-2xl">
                <h2 className="font-serif text-title-1 italic">{section.name}</h2>
                <p className="mt-1 text-callout text-muted-foreground">{section.description}</p>
              </header>
            ) : null}
            <ul className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 md:gap-x-5 md:gap-y-8 lg:grid-cols-4">
              {section.niches.flatMap((slug) => {
                const preset = findPreset(slug)
                return preset ? (
                  <li key={slug}>
                    <NicheCard niche={preset} />
                  </li>
                ) : (
                  []
                )
              })}
            </ul>
          </section>
        ))}

        {otherHubs.length > 0 ? (
          <section>
            <SectionHeader title="Also explore" />
            <div className="grid gap-4 md:grid-cols-2">
              {otherHubs.map((other) => (
                <HubCard key={other.slug} hub={other} size="md" />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </Screen>
  )
}
