"use client"

import { Play, TrendingUp } from "lucide-react"
import Link from "next/link"
import { MediaImage } from "@/components/ds/media-image"
import { FeedCard } from "@/components/niche/feed/feed-card"
import { TasteCard } from "@/components/taste/taste-card"
import { getAudioEngine } from "@/lib/audio/use-audio"
import type { FeedItem } from "@/lib/feed/types"
import { formatAge } from "@/lib/time"
import type { RisingChip, SectionId, TodaySection } from "@/lib/today/edition"
import { FitEditorial } from "./fit-editorial"
import { GrailCatalog } from "./grail-catalog"
import { CopOrDrop } from "@/components/votes/cop-or-drop"
import { IssueSectionHeader } from "./issue-section-header"
import { TeaSpread } from "./tea-spread"

const KICKERS: Record<SectionId, string> = {
  tea: "News",
  fit: "Style",
  grail: "Archive",
  sound: "Music",
  scene: "Movement",
}

/** One section of the issue, in its own layout. */
export function IssueSection({
  section,
  index,
  now,
  reason,
}: {
  section: TodaySection
  index: number
  now: number
  reason?: string | null
}) {
  const id = `issue-${section.id}`
  return (
    <section
      aria-labelledby={id}
      data-kind={section.id === "sound" ? "music" : section.id}
      className="scroll-mt-20"
    >
      <IssueSectionHeader
        index={index}
        title={section.title}
        kicker={KICKERS[section.id]}
        reason={reason}
        id={id}
      />
      {section.id === "tea" ? (
        <TeaSpread items={section.items} now={now} />
      ) : section.id === "fit" ? (
        <FitEditorial items={section.items} />
      ) : section.id === "grail" ? (
        <GrailCatalog items={section.items} />
      ) : section.id === "sound" ? (
        <SoundList items={section.items} now={now} />
      ) : (
        <Scene section={section} now={now} />
      )}
    </section>
  )
}

function CardGrid({ items, now }: { items: readonly FeedItem[]; now: number }) {
  return (
    <ul className="columns-2 gap-4 md:gap-5 xl:columns-3">
      {items.map((item) => (
        <li key={item.id} className="mb-7 break-inside-avoid">
          <TasteCard item={item} niche={null} reason={null}>
            <FeedCard item={item} now={now} />
          </TasteCard>
        </li>
      ))}
    </ul>
  )
}

const KIND_LABEL: Record<string, string> = { single: "Single", ep: "EP", album: "Album" }

/** The Sound: at most five tracks, compact rows. A magazine's music page, not a player. */
function SoundList({ items, now }: { items: readonly FeedItem[]; now: number }) {
  return (
    <ol className="divide-y divide-border">
      {items.map((item, i) => {
        const preview = typeof item.meta.previewUrl === "string" ? item.meta.previewUrl : null
        const meta =
          item.type === "release"
            ? [
                KIND_LABEL[String(item.meta.kind)] ?? "Release",
                formatAge(item.publishedAt, new Date(now)),
              ]
            : [item.subtitle]
        return (
          <li key={item.id} className="flex items-center gap-3 py-2.5">
            <span className="w-5 text-right font-serif text-callout text-subtle italic tabular-nums">
              {i + 1}
            </span>
            <span className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
              {item.imageUrl ? <MediaImage src={item.imageUrl} alt="" sizes="48px" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-callout font-semibold">{item.title}</span>
              <span className="block truncate text-caption text-muted-foreground">
                {[item.type === "release" ? item.subtitle : null, ...meta]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <CopOrDrop item={item} size="sm" className="mt-1.5" />
            </span>
            {preview ? (
              <button
                type="button"
                aria-label={`Play ${item.title}`}
                onClick={() =>
                  getAudioEngine().playQueue(
                    [
                      {
                        id: item.id,
                        src: preview,
                        title: item.title,
                        artist: item.subtitle ?? "",
                        artworkUrl: item.imageUrl,
                        spotifyUrl: item.url,
                        appleUrl:
                          typeof item.meta.appleUrl === "string" ? item.meta.appleUrl : null,
                        niche: typeof item.meta.niche === "string" ? item.meta.niche : null,
                      },
                    ],
                    0,
                    { owner: "player", context: "Today" },
                  )
                }
                className="grid size-9 shrink-0 place-items-center rounded-full border border-border-strong"
              >
                <Play
                  aria-hidden
                  className="size-3.5 translate-x-px"
                  fill="currentColor"
                  strokeWidth={0}
                />
              </button>
            ) : item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-caption font-semibold text-muted-foreground underline-offset-2 hover:underline"
              >
                Listen
              </a>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

/** The Scene: what's moving (rising entities, friends) and more from your niches. */
function Scene({ section, now }: { section: TodaySection; now: number }) {
  return (
    <div className="space-y-6">
      {section.rising && section.rising.length > 0 ? <RisingList chips={section.rising} /> : null}
      {section.friends && section.friends.length > 0 ? (
        <div>
          <p className="mb-2 text-caption font-semibold tracking-[0.15em] text-muted-foreground uppercase">
            Your friends are into
          </p>
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
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {section.items.length > 0 ? <CardGrid items={section.items} now={now} /> : null}
    </div>
  )
}

const GROUPS = [
  { scope: "yours", label: null },
  { scope: "nearby", label: "Nearby scenes" },
  { scope: "everywhere", label: "Across subcult" },
] as const

/**
 * What's moving, ranked, each with its counted reason ("3 new headlines +
 * 1 release this week"). Entities from beyond the reader's own scenes sit
 * in their own labelled groups, never mixed in.
 */
function RisingList({ chips }: { chips: readonly RisingChip[] }) {
  const groups = GROUPS.map((group) => ({
    ...group,
    chips: chips.filter((chip) => (chip.scope ?? "yours") === group.scope),
  }))
  // Ranks run on across the groups (1-3 yours, 4-5 nearby).
  const starts = groups.map((_, i) => groups.slice(0, i).reduce((n, g) => n + g.chips.length, 0))
  return (
    <div className="space-y-6">
      {groups.map(({ scope, label, chips: group }, groupIndex) => {
        if (group.length === 0) return null
        return (
          <div key={scope}>
            {label ? (
              <p className="mb-2 text-caption font-semibold tracking-[0.15em] text-muted-foreground uppercase">
                {label}
              </p>
            ) : null}
            <ol className="divide-y divide-border border-y border-border">
              {group.map((chip, i) => {
                const rank = (starts[groupIndex] ?? 0) + i + 1
                return (
                  <li key={chip.entity}>
                    <Link href={chip.href} className="group flex items-center gap-4 py-3">
                      <span className="w-5 shrink-0 font-serif text-title-3 text-muted-foreground italic tabular-nums">
                        {rank}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-callout font-semibold group-hover:underline">
                          {chip.label}
                        </span>
                        {chip.reason ? (
                          <span className="block text-caption text-pretty text-muted-foreground">
                            {chip.reason}
                          </span>
                        ) : null}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-footnote font-semibold tabular-nums">
                        <TrendingUp aria-hidden className="size-4" strokeWidth={2} />
                        {chip.ratio}×
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ol>
          </div>
        )
      })}
    </div>
  )
}
