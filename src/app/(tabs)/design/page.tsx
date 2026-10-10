import type { Metadata } from "next"
import { ArrowUpRight, Bookmark, Search } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ds/button"
import { Cover } from "@/components/ds/cover"
import { NicheAvatar } from "@/components/ds/niche-avatar"
import { SectionHeader } from "@/components/ds/section-header"
import { Screen } from "@/components/shell/screen"
import { ThemeToggle } from "@/components/shell/theme-toggle"
import { Skeleton } from "@/components/ui/skeleton"
import { SEED_PROFILES } from "@/lib/niches/catalog"
import { SaveDemo, SheetDemo } from "./demos"

export const metadata: Metadata = { title: "Design system", robots: { index: false } }

const TYPE_SCALE = [
  ["display", "font-serif text-display italic", "gorpcore"],
  ["title-1", "font-serif text-title-1 italic", "dark academia"],
  ["title-2", "text-title-2 font-semibold", "Trending now"],
  ["title-3", "text-title-3 font-semibold", "Section title"],
  ["headline", "text-headline font-semibold", "Card headline"],
  ["body", "text-body", "Body copy for descriptions and longer reads."],
  ["callout", "text-callout text-muted-foreground", "Secondary information"],
  ["footnote", "text-footnote text-muted-foreground", "Metadata · 3h"],
  ["overline", "text-overline uppercase text-muted-foreground", "Overline label"],
] as const

const COLORS = [
  "background",
  "card",
  "elevated",
  "muted",
  "foreground",
  "muted-foreground",
  "subtle-foreground",
  "border-strong",
] as const

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border py-10">
      <p className="mb-6 text-overline font-medium text-muted-foreground uppercase">{title}</p>
      {children}
    </section>
  )
}

/** Living reference for every token and component in the system. */
export default function DesignPage() {
  const niches = SEED_PROFILES.slice(0, 8)
  return (
    <Screen>
      <div className="container-page pt-10 md:pt-16">
        <div className="flex flex-wrap items-end justify-between gap-6 pb-10">
          <div>
            <p className="text-overline font-medium text-muted-foreground uppercase">subcult</p>
            <h1 className="mt-2 font-serif text-display italic">Design system</h1>
          </div>
          <ThemeToggle />
        </div>

        <Block title="Type scale · Geist + Instrument Serif">
          <div className="space-y-5">
            {TYPE_SCALE.map(([token, className, sample]) => (
              <div key={token} className="grid gap-1 md:grid-cols-[8rem_1fr] md:items-baseline">
                <code className="text-caption text-subtle">{token}</code>
                <p className={className}>{sample}</p>
              </div>
            ))}
          </div>
        </Block>

        <Block title="Color">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {COLORS.map((token) => (
              <div key={token}>
                <div
                  className="h-16 rounded-xl shadow-[var(--shadow-hairline)]"
                  style={{ background: `var(--${token})` }}
                />
                <code className="mt-2 block text-caption text-muted-foreground">--{token}</code>
              </div>
            ))}
          </div>
        </Block>

        <Block title="Generative covers · mesh gradient + grain">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {niches.map((niche) => (
              <Cover
                key={niche.slug}
                palette={niche.palette}
                seed={niche.slug}
                className="relative aspect-[4/5] rounded-2xl"
              >
                <p className="absolute bottom-3 left-4 font-serif text-title-3 text-white italic">
                  {niche.name}
                </p>
              </Cover>
            ))}
          </div>
        </Block>

        <Block title="Avatars · story ring">
          <div className="flex flex-wrap items-center gap-5">
            {niches.slice(0, 5).map((niche, index) => (
              <NicheAvatar
                key={niche.slug}
                slug={niche.slug}
                name={niche.name}
                palette={niche.palette}
                unseen={index % 2 === 0}
                size={index === 0 ? "lg" : "md"}
              />
            ))}
          </div>
        </Block>

        <Block title="Buttons · icons 1.5 stroke">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button size="icon" variant="secondary" aria-label="Search">
              <Search aria-hidden />
            </Button>
            <Button size="icon" variant="secondary" aria-label="Save">
              <Bookmark aria-hidden />
            </Button>
            <Button variant="outline" size="sm">
              Open <ArrowUpRight aria-hidden />
            </Button>
          </div>
        </Block>

        <Block title="Radius · elevation">
          <div className="flex flex-wrap gap-4">
            {(["rounded-lg", "rounded-xl", "rounded-2xl", "rounded-3xl"] as const).map((radius) => (
              <div
                key={radius}
                className={`grid size-24 place-items-center bg-card shadow-card ${radius}`}
              >
                <code className="text-caption text-muted-foreground">
                  {radius.replace("rounded-", "")}
                </code>
              </div>
            ))}
            <div className="grid size-24 place-items-center rounded-2xl bg-elevated shadow-pop">
              <code className="text-caption text-muted-foreground">pop</code>
            </div>
          </div>
        </Block>

        <Block title="Interaction">
          <div className="flex flex-wrap items-start gap-8">
            <SaveDemo palette={niches[1].palette} />
            <SheetDemo />
          </div>
        </Block>

        <Block title="Loading · shimmer, never spinners">
          <div className="grid max-w-md gap-3">
            <Skeleton className="aspect-video rounded-2xl" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </Block>

        <Block title="Section header">
          <SectionHeader
            overline="for you"
            title="Fresh this week"
            serif
            action={{ label: "See all", href: "/explore" }}
          />
        </Block>
      </div>
    </Screen>
  )
}
