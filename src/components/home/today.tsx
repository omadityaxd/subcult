"use client"

import { ArrowDown, ArrowUpRight, Check, TrendingUp } from "lucide-react"
import Link from "next/link"
import { type ReactNode, useEffect, useState } from "react"
import { MediaImage } from "@/components/ds/media-image"
import { FeedCard } from "@/components/niche/feed/feed-card"
import { TasteCard } from "@/components/taste/taste-card"
import { Skeleton } from "@/components/ui/skeleton"
import type { FeedItem } from "@/lib/feed/types"
import type { ApiResponse } from "@/lib/request"
import { readSaves } from "@/lib/saves"
import { entitiesOfItem } from "@/lib/taste/entities"
import { isColdStart } from "@/lib/taste/model"
import { pageReasons } from "@/lib/taste/rank"
import { readTasteVector, useTasteVector } from "@/lib/taste/store"
import { formatAge } from "@/lib/time"
import type { TodayEdition, TodaySection } from "@/lib/today/edition"
import { sinceLabel } from "@/lib/today/edition"
import { touchVisit } from "@/lib/today/visits"

const ENTITIES_SENT = 40
const BRAND_SAVE = /^subcult:brand:([a-z0-9-]+)$/

const MODE_LINE: Record<TodayEdition["mode"], string> = {
  morning: "Morning edition",
  day: "Today's edition",
  night: "Late edition",
  weekend: "Weekend edition",
}

type Load =
  | { state: "loading" }
  | { state: "failed" }
  | { state: "ready"; edition: TodayEdition; lastVisit: number | null; timeZone: string }

/**
 * Today: a finite personal edition at the top of For You, built from this
 * person's taste for their local moment, then "you're caught up".
 */
/** Reads taste, saves and the visit marker straight from storage, then asks for the edition. */
async function requestEdition(lastVisit: number | null): Promise<Load> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC"
  const entities = [...readTasteVector().values()]
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, ENTITIES_SENT)
    .map((a) => ({ ref: a.entity, score: Math.round(a.score * 100) / 100 }))
  const brands = readSaves().flatMap((s) => BRAND_SAVE.exec(s.id)?.[1] ?? [])
  try {
    const response = await fetch("/api/today", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entities, brands, lastVisit, timeZone }),
    })
    const body = (await response.json()) as ApiResponse<TodayEdition>
    if (!body.success) return { state: "failed" }
    return { state: "ready", edition: body.data, lastVisit, timeZone }
  } catch {
    return { state: "failed" }
  }
}

export function Today({ coldExtras }: { coldExtras: ReactNode }) {
  const [load, setLoad] = useState<Load>({ state: "loading" })
  const [attempt, setAttempt] = useState(0)
  const vector = useTasteVector()
  // The visit marker moves once per mount, not per retry.
  const [lastVisit] = useState(() => (typeof window === "undefined" ? null : touchVisit()))

  // Built once per visit (and per retry): the edition doesn't reshuffle while you read it.
  useEffect(() => {
    let cancelled = false
    void requestEdition(lastVisit).then((result) => {
      if (!cancelled) setLoad(result)
    })
    return () => {
      cancelled = true
    }
  }, [attempt, lastVisit])

  if (load.state === "loading") return <TodaySkeleton />
  if (load.state === "failed") {
    return (
      <section aria-label="Today" className="rounded-3xl border border-border p-6 text-center">
        <p className="font-serif text-title-3 italic">Today didn&apos;t load</p>
        <button
          type="button"
          onClick={() => {
            setLoad({ state: "loading" })
            setAttempt((n) => n + 1)
          }}
          className="mt-4 h-10 rounded-full border border-border-strong px-5 text-footnote font-semibold"
        >
          Try again
        </button>
      </section>
    )
  }

  const { edition, timeZone } = load
  const fresh = (item: FeedItem) =>
    lastVisit !== null && item.publishedAt !== null && Date.parse(item.publishedAt) > lastVisit
  const newCount = edition.sections.flatMap((s) => s.items).filter(fresh).length
  const cold = edition.cold || isColdStart(vector)
  const risingEntities = new Set(
    edition.sections.flatMap((s) => s.rising ?? []).map((chip) => chip.entity),
  )

  return (
    <section aria-label="Today">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-overline font-medium text-muted-foreground uppercase">
            {MODE_LINE[edition.mode]}
          </p>
          <h2 className="font-serif text-title-1 italic">Today</h2>
        </div>
        <p className="pb-1 text-footnote text-muted-foreground tabular-nums">
          {edition.count} {edition.count === 1 ? "thing" : "things"}
        </p>
      </header>

      {lastVisit !== null ? (
        <div className="mt-4 flex items-center gap-3 text-footnote text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          <span>
            {newCount > 0 ? `${newCount} new ` : "Nothing new "}
            {sinceLabel(lastVisit, edition.generatedAt, timeZone)}
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>
      ) : null}

      {cold ? <div className="mt-6 space-y-6">{coldExtras}</div> : null}

      <div className="mt-8 space-y-12">
        {edition.sections.map((section) => (
          <Section
            key={section.id}
            section={section}
            now={edition.generatedAt}
            risingEntities={risingEntities}
          />
        ))}
      </div>

      <CaughtUp count={edition.count} />
    </section>
  )
}

function Section({
  section,
  now,
  risingEntities,
}: {
  section: TodaySection
  now: number
  risingEntities: ReadonlySet<string>
}) {
  const vector = useTasteVector()
  const reasons = pageReasons(section.items, vector, null)
  const isRising = (item: FeedItem) =>
    entitiesOfItem(item).some(
      (ref) => ref.startsWith("niche:") === false && risingEntities.has(ref),
    )
  return (
    <section aria-labelledby={`today-${section.id}`}>
      <h3 id={`today-${section.id}`} className="mb-4 text-title-3 font-semibold">
        {section.title}
      </h3>
      {section.id === "friends" && section.friends ? (
        <ul className="flex flex-wrap gap-2">
          {section.friends.map((chip) => (
            <li key={chip.entity}>
              <Link
                href={chip.href}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-border-strong px-4 text-footnote font-semibold"
              >
                {chip.label}
                <span className="font-normal text-muted-foreground">
                  {chip.handles
                    .slice(0, 2)
                    .map((h) => `@${h}`)
                    .join(", ")}
                  {chip.handles.length > 2 ? ` +${chip.handles.length - 2}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : section.id === "rising" && section.rising ? (
        <ul className="flex flex-wrap gap-2">
          {section.rising.map((chip) => (
            <li key={chip.entity}>
              <Link
                href={chip.href}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-border-strong pr-4 pl-3 text-footnote font-semibold"
              >
                <TrendingUp aria-hidden className="size-4 text-accent" strokeWidth={2} />
                {chip.label}
                <span className="font-normal text-muted-foreground tabular-nums">
                  {chip.ratio}×
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : section.id === "digest" ? (
        <ol className="divide-y divide-border rounded-2xl border border-border">
          {section.items.map((item, i) => (
            <li key={item.id}>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-4 px-4 py-3.5"
              >
                <span className="font-serif text-title-3 text-subtle italic tabular-nums">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-callout font-semibold">{item.title}</span>
                  <span className="mt-0.5 block text-caption text-muted-foreground">
                    {[item.subtitle, formatAge(item.publishedAt, new Date(now))]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <ArrowUpRight aria-hidden className="mt-1 size-4 shrink-0 text-subtle" />
              </a>
            </li>
          ))}
        </ol>
      ) : section.id === "drops" ? (
        <ul className="-mx-(--gutter) no-scrollbar flex gap-4 overflow-x-auto px-(--gutter)">
          {section.items.map((item, i) => (
            <li key={item.id} className="w-40 shrink-0 sm:w-48">
              <TasteCard
                item={item}
                niche={null}
                reason={reasons[i] ?? null}
                rising={isRising(item)}
              >
                <ReleaseCard item={item} now={now} />
              </TasteCard>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="columns-1 gap-5 sm:columns-2 xl:columns-3">
          {section.items.map((item, i) => (
            <li key={item.id} className="mb-7 break-inside-avoid">
              <TasteCard
                item={item}
                niche={null}
                reason={reasons[i] ?? null}
                rising={isRising(item)}
              >
                <FeedCard item={item} now={now} />
              </TasteCard>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const KIND_LABEL: Record<string, string> = { single: "Single", ep: "EP", album: "Album" }

function ReleaseCard({ item, now }: { item: FeedItem; now: number }) {
  const kind = KIND_LABEL[String(item.meta.kind)] ?? "Release"
  const body = (
    <>
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
        {item.imageUrl ? <MediaImage src={item.imageUrl} alt="" sizes="192px" /> : null}
      </div>
      <p className="mt-2 line-clamp-2 text-callout font-semibold">{item.title}</p>
      <p className="truncate text-caption text-muted-foreground">
        {[kind, item.subtitle, formatAge(item.publishedAt, new Date(now))]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </>
  )
  return item.url ? (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
      {body}
      <span className="sr-only">(opens Apple Music)</span>
    </a>
  ) : (
    <div>{body}</div>
  )
}

function CaughtUp({ count }: { count: number }) {
  return (
    <div className="mt-14 flex flex-col items-center text-center">
      <span className="grid size-12 place-items-center rounded-full border border-border-strong">
        <Check aria-hidden className="size-5" strokeWidth={2} />
      </span>
      <p className="mt-4 font-serif text-title-2 italic">You&apos;re caught up</p>
      <p className="mt-1 text-callout text-muted-foreground">
        {count > 0
          ? "That's today. Come back tomorrow for the next one."
          : "Quiet day in your scenes."}
      </p>
      <a
        href="#latest"
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-border-strong px-5 text-footnote font-semibold"
      >
        Keep exploring <ArrowDown aria-hidden className="size-4" strokeWidth={1.75} />
      </a>
    </div>
  )
}

function TodaySkeleton() {
  return (
    <section aria-label="Loading Today" aria-busy="true">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-2 h-9 w-36" />
      <div className="mt-8 flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="aspect-square w-40 shrink-0 rounded-2xl" />
        ))}
      </div>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="hidden h-40 rounded-2xl sm:block" />
        <Skeleton className="hidden h-40 rounded-2xl xl:block" />
      </div>
    </section>
  )
}
