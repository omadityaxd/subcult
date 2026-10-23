"use client"

import { ArrowDown, Check } from "lucide-react"
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react"
import { SectionBoundary } from "@/components/ds/section-boundary"
import { EraRecheck } from "@/components/issue/era-recheck"
import { IssueCover, ShareCoverButton } from "@/components/issue/issue-cover"
import { IssueSection } from "@/components/issue/issue-sections"
import { Skeleton } from "@/components/ui/skeleton"
import { track } from "@/lib/analytics"
import type { FeedItem } from "@/lib/feed/types"
import type { ApiResponse } from "@/lib/request"
import { readSaves } from "@/lib/saves"
import { sectionReason } from "@/lib/taste/rank"
import { readTasteVector, useTasteVector } from "@/lib/taste/store"
import { formatAge } from "@/lib/time"
import type { TodayEdition } from "@/lib/today/edition"
import { sinceLabel } from "@/lib/today/edition"
import { keepIssue, useIssueArchive } from "@/lib/today/issue-store"
import { issueNumber, localDay } from "@/lib/today/issues"
import { useLastVisit } from "@/lib/today/use-last-visit"

const ENTITIES_SENT = 40
const BRAND_SAVE = /^subcult:brand:([a-z0-9-]+)$/

const MODE_LINE: Record<TodayEdition["mode"], string> = {
  morning: "Morning edition",
  day: "Daily edition",
  night: "Late edition",
  weekend: "Weekend edition",
}

type Load =
  | { state: "loading" }
  | { state: "failed" }
  | {
      state: "ready"
      edition: TodayEdition
      lastVisit: number | null
      timeZone: string
      /** Offline: this is the last issue saved on the device. */
      saved?: boolean
    }

const LAST_EDITION_KEY = "subcult-today-last"

function saveEdition(edition: TodayEdition): void {
  try {
    localStorage.setItem(LAST_EDITION_KEY, JSON.stringify(edition))
  } catch {
    // Storage full or blocked: offline just shows the error state.
  }
}

function savedEdition(): TodayEdition | null {
  try {
    const raw = localStorage.getItem(LAST_EDITION_KEY)
    return raw ? (JSON.parse(raw) as TodayEdition) : null
  } catch {
    return null
  }
}

/** Offline (or a failed request): the last issue on this device, marked as such. */
function fallback(lastVisit: number | null, timeZone: string): Load {
  const edition = savedEdition()
  return edition
    ? { state: "ready", edition, lastVisit, timeZone, saved: true }
    : { state: "failed" }
}

/** Reads taste, saves and the visit marker straight from storage, then asks for the issue. */
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
    if (!body.success) return fallback(lastVisit, timeZone)
    saveEdition(body.data)
    return { state: "ready", edition: body.data, lastVisit, timeZone }
  } catch {
    return fallback(lastVisit, timeZone)
  }
}

function dateLabel(now: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(now)
  } catch {
    return new Date(now).toDateString()
  }
}

/**
 * Today is an Issue: the reader's daily subculture magazine, numbered from
 * their first visit. Cover, then The Tea, The Fit, The Grail, The Sound,
 * The Scene, then the back page.
 */
export function Today({
  coldExtras,
  initial = null,
  issueNo: serverIssueNo = 1,
}: {
  coldExtras: ReactNode
  /** Server-rendered issue (from the taste cookie): no client round trip. */
  initial?: { edition: TodayEdition; lastVisit: number | null; timeZone: string } | null
  /** The server's best guess from the issue cookie; the device's archive confirms it. */
  issueNo?: number
}) {
  const [load, setLoad] = useState<Load>(() =>
    initial ? { state: "ready", ...initial } : { state: "loading" },
  )
  const [attempt, setAttempt] = useState(0)
  const archive = useIssueArchive()
  const vector = useTasteVector()
  // Read after hydration (undefined until then), once per page load, not per retry.
  const lastVisit = useLastVisit()

  // Built once per visit (and per retry): the issue doesn't reshuffle while you read it.
  useEffect(() => {
    let cancelled = false
    if (initial && attempt === 0) {
      saveEdition(initial.edition)
      track("today_viewed", {
        items: initial.edition.count,
        mode: initial.edition.mode,
        cold: initial.edition.cold,
        rendered: "server",
      })
      return
    }
    if (lastVisit === undefined) return // wait for the device's visit marker
    void requestEdition(lastVisit).then((result) => {
      if (cancelled) return
      setLoad(result)
      if (result.state === "ready") {
        track("today_viewed", {
          items: result.edition.count,
          mode: result.edition.mode,
          cold: result.edition.cold,
        })
      }
    })
    return () => {
      cancelled = true
    }
    // initial is the server's render for this page view; it never changes after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, lastVisit])

  // Keep today's issue in the archive (once per local day); the number derives from it.
  const ready = load.state === "ready" && !load.saved ? load : null
  useEffect(() => {
    if (ready) keepIssue(ready.edition, localDay(ready.edition.generatedAt, ready.timeZone))
  }, [ready])

  if (load.state === "loading") return <TodaySkeleton />
  if (load.state === "failed") {
    return (
      <section aria-label="Today" className="rounded-3xl border border-border p-6 text-center">
        <p className="font-serif text-title-3 italic">Today&apos;s issue didn&apos;t load</p>
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

  const { edition, timeZone, saved } = load
  const fresh = (item: FeedItem) =>
    lastVisit != null && item.publishedAt !== null && Date.parse(item.publishedAt) > lastVisit
  const newCount = edition.sections.flatMap((s) => s.items).filter(fresh).length
  const date = dateLabel(edition.generatedAt, timeZone)
  // The device's archive is the source of truth once it has loaded; the cookie-based guess before.
  const issueNo =
    archive.issues.length > 0
      ? issueNumber(archive, localDay(edition.generatedAt, timeZone))
      : serverIssueNo

  return (
    <section aria-label="Today" data-testid="issue">
      <IssueCover cover={edition.cover} issueNo={issueNo} dateLabel={date} debut={issueNo === 1} />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-footnote text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">{MODE_LINE[edition.mode]}</span>
          {saved
            ? ` · saved copy from ${formatAge(new Date(edition.generatedAt).toISOString(), new Date())} ago`
            : lastVisit != null
              ? ` · ${newCount > 0 ? `${newCount} new` : "nothing new"} ${sinceLabel(lastVisit, edition.generatedAt, timeZone)}`
              : null}
        </p>
        <ShareCoverButton
          cover={edition.cover}
          issueNo={issueNo}
          day={localDay(edition.generatedAt, timeZone)}
        />
      </div>

      {edition.cold ? <div className="mt-8 space-y-6">{coldExtras}</div> : null}

      <div className="mt-12 space-y-16">
        {edition.sections.map((section, i) => (
          <Fragment key={section.id}>
            {i === 2 ? <EraRecheck now={edition.generatedAt} /> : null}
            <SectionBoundary label={section.title}>
              <IssueSection
                key={section.id}
                section={section}
                index={i + 1}
                now={edition.generatedAt}
                reason={section.id === "scene" ? null : sectionReason(section.items, vector)}
              />
            </SectionBoundary>
          </Fragment>
        ))}
      </div>

      <BackPage count={edition.count} teaser={edition.backPage.teaser} />
    </section>
  )
}

function BackPage({ count, teaser }: { count: number; teaser: string | null }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        track("today_caught_up", { items: count })
        observer.disconnect()
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [count])
  return (
    <div
      ref={ref}
      className="mt-20 flex flex-col items-center border-t border-foreground/80 pt-10 text-center"
    >
      <p className="text-caption font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        Back page
      </p>
      <span className="mt-4 grid size-12 place-items-center rounded-full border border-border-strong">
        <Check aria-hidden className="size-5" strokeWidth={2} />
      </span>
      <p className="mt-4 font-serif text-title-1 italic">You&apos;re caught up</p>
      <p className="mt-1 text-callout text-muted-foreground">
        {count > 0 ? "That's the issue. The next one lands tomorrow." : "Quiet day in your scenes."}
      </p>
      {teaser ? <p className="mt-3 font-serif text-title-3 italic">{teaser}</p> : null}
      <a
        href="#latest"
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-full border border-border-strong px-5 text-footnote font-semibold"
      >
        Keep browsing <ArrowDown aria-hidden className="size-4" strokeWidth={1.75} />
      </a>
    </div>
  )
}

export function TodaySkeleton() {
  return (
    <section aria-label="Loading today's issue" aria-busy="true">
      <Skeleton className="-mx-(--gutter) aspect-[4/5] rounded-none md:mx-0 md:aspect-[16/9] md:rounded-3xl" />
      <Skeleton className="mt-3 h-4 w-48" />
      <div className="mt-12 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="hidden h-40 rounded-2xl sm:block" />
          <Skeleton className="hidden h-40 rounded-2xl xl:block" />
        </div>
      </div>
    </section>
  )
}
