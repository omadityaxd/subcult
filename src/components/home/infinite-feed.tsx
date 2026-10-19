"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FeedCard } from "@/components/niche/feed/feed-card"
import { TasteCard } from "@/components/taste/taste-card"
import { Skeleton } from "@/components/ui/skeleton"
import { type FeedFilter, applyFilter } from "@/lib/feed/filters"
import type { HomePage } from "@/lib/feed/home"
import type { ApiResponse } from "@/lib/request"
import { type TasteVector, isColdStart } from "@/lib/taste/model"
import { pageReasons, personalizePage } from "@/lib/taste/rank"
import { readTasteVector, useSeen, useTasteVector } from "@/lib/taste/store"
import { dedupeMusic } from "@/lib/feed/dedupe-music"
import { dedupeImages } from "@/lib/images/curate"

const TASTE_NICHES = 20

/** "rage:5.2,jerk:3": the person's niche affinities, for a personal page order. */
export function tasteParam(vector: TasteVector): string | null {
  if (isColdStart(vector)) return null
  const niches = [...vector.values()]
    .filter((a) => a.entity.startsWith("niche:"))
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, TASTE_NICHES)
    .map((a) => `${a.entity.slice("niche:".length)}:${a.score.toFixed(2)}`)
  return niches.length > 0 ? niches.join(",") : null
}

interface InfiniteFeedProps {
  initial: HomePage | null
  now: number
  filter?: FeedFilter
}

/** Masonry home feed that loads the next niche's page as you near the end. */
export function InfiniteFeed({ initial, now, filter = "all" }: InfiniteFeedProps) {
  const [pages, setPages] = useState<HomePage[]>(initial ? [initial] : [])
  // Frozen once per visit so cursors keep pointing into the same order. Not rendered,
  // so reading storage here can't cause a hydration mismatch.
  const [taste] = useState(() => tasteParam(readTasteVector()))
  // A personal order starts over; the first (default) page stays, deduped below.
  const [cursor, setCursor] = useState<number | null>(taste ? 0 : initial ? initial.nextCursor : 0)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)
  const vector = useTasteVector()
  const seen = useSeen()

  const loadMore = useCallback(async () => {
    if (cursor === null || loading) return
    setLoading(true)
    try {
      const query = taste ? `&taste=${encodeURIComponent(taste)}` : ""
      const response = await fetch(`/api/feed?cursor=${cursor}${query}`)
      const body = (await response.json()) as ApiResponse<HomePage>
      if (!body.success) throw new Error(body.error)
      setPages((current) =>
        body.data.niche && !current.some((page) => page.niche.slug === body.data.niche.slug)
          ? [...current, body.data]
          : current,
      )
      setCursor(body.data.nextCursor)
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [cursor, loading, taste])

  useEffect(() => {
    if (cursor === null || failed || !sentinel.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore()
      },
      { rootMargin: "900px 0px" },
    )
    observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [cursor, failed, loadMore])

  const items = useMemo(() => {
    // One song plays once and one picture shows once across every page (a track and its
    // album, or one photo reaching several niches' feeds).
    const heard = new Set<string>()
    const pictured = { keys: new Set<string>(), hashes: [] as string[] }
    return pages.flatMap((page) => {
      const shown = dedupeImages(
        dedupeMusic(
          applyFilter(personalizePage(page.items, vector, seen, page.niche.slug), filter),
          heard,
        ),
        (item) => item.imageUrl,
        undefined,
        pictured,
      )
      const reasons = pageReasons(shown, vector, page.niche.slug, {
        slug: page.niche.slug,
        why: page.why ?? "default",
        from: page.from,
      })
      return shown.map((item, i) => ({
        item,
        niche: page.niche,
        reason: reasons[i] ?? null,
        key: `${page.niche.slug}:${item.id}`,
      }))
    })
  }, [pages, vector, seen, filter])

  return (
    <>
      {items.length === 0 && filter !== "all" && cursor === null ? (
        <p className="py-10 text-center text-callout text-muted-foreground">
          Nothing here yet for this filter.
        </p>
      ) : null}
      <ul className="columns-1 gap-5 sm:columns-2 xl:columns-3">
        {items.map(({ item, niche, reason, key }) => (
          <li key={key} className="mb-7 break-inside-avoid">
            <TasteCard item={item} niche={niche} reason={reason}>
              <FeedCard item={item} context={niche.name} now={now} />
            </TasteCard>
          </li>
        ))}
      </ul>
      {cursor !== null ? (
        <div
          ref={sentinel}
          aria-busy={loading}
          aria-label="Loading more"
          className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
        >
          {failed ? (
            <button
              type="button"
              onClick={() => {
                setFailed(false)
                void loadMore()
              }}
              className="col-span-full h-12 rounded-full border border-border-strong text-callout font-medium hover:bg-muted"
            >
              Couldn&apos;t load more. Try again
            </button>
          ) : (
            <>
              <Skeleton className="aspect-square rounded-2xl" />
              <Skeleton className="hidden aspect-video rounded-2xl sm:block" />
              <Skeleton className="hidden aspect-square rounded-2xl xl:block" />
            </>
          )}
        </div>
      ) : (
        <p className="py-12 text-center font-serif text-title-3 text-muted-foreground italic">
          You&apos;ve reached the end. Go touch grass.
        </p>
      )}
    </>
  )
}
