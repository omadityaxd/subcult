"use client"

import { useState } from "react"
import type { TagRef, TaggedItem } from "@/lib/taxonomy/tagging"
import { cn } from "@/lib/utils"
import { FeedCard } from "./feed-card"
import { ProgressiveList } from "./progressive-list"
import { FewCards } from "./few-cards"
import { FEW_CARDS } from "@/lib/feed/few"

interface TaggedFeedProps {
  items: readonly TaggedItem[]
  tags: readonly TagRef[]
  now: number
}

/** The niche's masonry feed with tag chips that filter it in place. */
export function TaggedFeed({ items, tags, now }: TaggedFeedProps) {
  const [active, setActive] = useState<string | null>(null)
  const visible = active ? items.filter((entry) => entry.tags.includes(active)) : items

  return (
    <>
      {tags.length > 0 ? (
        <div
          role="group"
          aria-label="Filter by tag"
          className="-mx-(--gutter) mb-6 no-scrollbar flex gap-2 overflow-x-auto px-(--gutter)"
        >
          <Chip selected={active === null} onClick={() => setActive(null)}>
            Everything
          </Chip>
          {tags.map((tag) => (
            <Chip
              key={tag.slug}
              selected={active === tag.slug}
              onClick={() => setActive(active === tag.slug ? null : tag.slug)}
            >
              {tag.name}
            </Chip>
          ))}
        </div>
      ) : null}
      {visible.length <= FEW_CARDS ? (
        <FewCards items={visible.map(({ item }) => item)} now={now} />
      ) : (
        <ProgressiveList
          // Remount on filter change so the reveal starts from the top of the new list.
          key={active ?? "all"}
          className="columns-1 gap-5 sm:columns-2 xl:columns-3"
          itemClassName="mb-7 break-inside-avoid"
          items={visible.map(({ item }) => ({
            key: item.id,
            node: <FeedCard item={item} now={now} />,
          }))}
        />
      )}
    </>
  )
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 rounded-full px-4 text-footnote font-medium whitespace-nowrap transition-colors",
        selected
          ? "bg-foreground text-background"
          : "border border-border-strong text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}
