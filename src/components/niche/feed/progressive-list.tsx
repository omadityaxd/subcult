"use client"

import { type ReactNode, useEffect, useRef, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"

interface ProgressiveListProps {
  items: readonly { key: string; node: ReactNode }[]
  className?: string
  itemClassName?: string
  /** Rendered up front; more reveal as the sentinel scrolls into view. */
  pageSize?: number
}

/**
 * Infinite-scroll reveal for server-rendered lists: shows a page, then the
 * next page each time the shimmer sentinel nears the viewport.
 */
export function ProgressiveList({
  items,
  className,
  itemClassName,
  pageSize = 9,
}: ProgressiveListProps) {
  const [visible, setVisible] = useState(pageSize)
  const sentinel = useRef<HTMLDivElement>(null)
  const hasMore = visible < items.length

  useEffect(() => {
    if (!hasMore || !sentinel.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible((count) => count + pageSize)
      },
      { rootMargin: "600px 0px" },
    )
    observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [hasMore, pageSize])

  return (
    <>
      <ul className={className}>
        {items.slice(0, visible).map((item) => (
          <li key={item.key} className={itemClassName}>
            {item.node}
          </li>
        ))}
      </ul>
      {hasMore ? (
        <div ref={sentinel} aria-hidden className="grid gap-5 sm:grid-cols-2">
          <Skeleton className="aspect-square rounded-2xl" />
          <Skeleton className="hidden aspect-square rounded-2xl sm:block" />
        </div>
      ) : null}
    </>
  )
}
