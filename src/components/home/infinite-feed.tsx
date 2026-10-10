"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { FeedCard } from "@/components/niche/feed/feed-card"
import { Skeleton } from "@/components/ui/skeleton"
import type { HomePage } from "@/lib/feed/home"
import type { ApiResponse } from "@/lib/request"

interface InfiniteFeedProps {
  initial: HomePage | null
  now: number
}

/** Masonry home feed that loads the next niche's page as you near the end. */
export function InfiniteFeed({ initial, now }: InfiniteFeedProps) {
  const [pages, setPages] = useState<HomePage[]>(initial ? [initial] : [])
  const [cursor, setCursor] = useState<number | null>(initial ? initial.nextCursor : 0)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (cursor === null || loading) return
    setLoading(true)
    try {
      const response = await fetch(`/api/feed?cursor=${cursor}`)
      const body = (await response.json()) as ApiResponse<HomePage>
      if (!body.success) throw new Error(body.error)
      setPages((current) => (body.data.niche ? [...current, body.data] : current))
      setCursor(body.data.nextCursor)
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [cursor, loading])

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

  const items = pages.flatMap((page) =>
    page.items.map((item) => ({
      item,
      context: page.niche.name,
      key: `${page.niche.slug}:${item.id}`,
    })),
  )

  return (
    <>
      <ul className="columns-1 gap-5 sm:columns-2 xl:columns-3">
        {items.map(({ item, context, key }) => (
          <li key={key} className="mb-7 break-inside-avoid">
            <FeedCard item={item} context={context} now={now} />
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
