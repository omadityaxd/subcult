"use client"

import { TrendingUp } from "lucide-react"
import Link from "next/link"
import { FeedCard } from "@/components/niche/feed/feed-card"
import { TasteCard } from "@/components/taste/taste-card"
import type { FeedItem } from "@/lib/feed/types"
import { formatAge } from "@/lib/time"
import type { RisingChip, SectionId, TodaySection } from "@/lib/today/edition"
import { FitEditorial } from "./fit-editorial"
import { GrailCatalog } from "./grail-catalog"
import { IssueSectionHeader } from "./issue-section-header"
import { TeaSpread } from "./tea-spread"
import { FewCards } from "@/components/niche/feed/few-cards"
import { FEW_CARDS } from "@/lib/feed/few"
import { type ListTrack, PlayableList } from "@/components/music/track-list"
import { spotify } from "@/lib/links"
import { useMemo } from "react"

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
  if (items.length <= FEW_CARDS) {
    return (
      <FewCards
        items={items}
        now={now}
        wrap={(item, node) => (
          <TasteCard item={item} niche={null} reason={null}>
            {node}
          </TasteCard>
        )}
      />
    )
  }
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

/** The Sound: 3–5 tracks that play right here (the shared list every track uses). */
function SoundList({ items, now }: { items: readonly FeedItem[]; now: number }) {
  const tracks = useMemo(() => items.map((item) => soundTrack(item, now)), [items, now])
  return <PlayableList tracks={tracks} context="The Sound" />
}

const metaString = (value: unknown) => (typeof value === "string" ? value : null)

function soundTrack(item: FeedItem, now: number): ListTrack {
  const artist = item.subtitle ?? ""
  return {
    id: item.id,
    title: item.title,
    artist,
    artworkUrl: item.imageUrl,
    // Releases link to Apple; Spotify gets a search for the same song as its secondary link.
    spotifyUrl: item.source === "spotify" ? item.url : spotify.search(`${artist} ${item.title}`),
    previewUrl: metaString(item.meta.previewUrl),
    appleUrl: metaString(item.meta.appleUrl) ?? (item.type === "release" ? item.url || null : null),
    niche: metaString(item.meta.niche),
    detail:
      item.type === "release"
        ? [
            KIND_LABEL[String(item.meta.kind)] ?? "Release",
            formatAge(item.publishedAt, new Date(now)),
          ]
            .filter(Boolean)
            .join(" · ")
        : null,
  }
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
