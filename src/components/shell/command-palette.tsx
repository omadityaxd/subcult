"use client"

import { useVisibleHeight } from "@/lib/ui/keyboard"
import { markNavigation, useOverlay } from "@/lib/ui/overlays"
import { Dialog } from "@base-ui/react/dialog"
import {
  Bell,
  Clock,
  Compass,
  CornerDownLeft,
  Loader2,
  Mic2,
  Newspaper,
  Play,
  Search,
  Sparkles,
  Tag,
  TrendingUp,
  Wand2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useState } from "react"
import { CdnImage } from "@/components/ds/cdn-image"
import { NicheAvatar } from "@/components/ds/niche-avatar"
import { BrandSheet } from "@/components/brand/brand-sheet"
import { ArtistSheet } from "@/components/niche/artists-row"
import { playTracks } from "@/lib/audio/play-tracks"
import type { NichePreset } from "@/lib/niches/catalog"
import type { ApiResponse } from "@/lib/request"
import { cn } from "@/lib/utils"
import { OPEN_SEARCH_EVENT } from "./nav"
import { type Entry, buildEntries } from "./search/entries"
import { GrailAlertForm } from "./search/grail-alert-form"
import { logSearch, useSearch } from "./search/use-search"

type Sheet =
  | { kind: "artist"; artist: { slug: string; name: string; imageUrl: string | null } }
  | { kind: "brand"; brand: { slug: string; name: string } }

function Thumb({
  src,
  round,
  children,
}: {
  src?: string | null
  round?: boolean
  children?: ReactNode
}) {
  return (
    <span
      className={cn(
        "relative grid size-11 shrink-0 place-items-center overflow-hidden bg-muted",
        round ? "rounded-full" : "rounded-lg",
      )}
    >
      {src ? <CdnImage src={src} alt="" fill sizes="44px" className="object-cover" /> : children}
    </span>
  )
}

const icon = (Icon: typeof Search) => <Icon aria-hidden className="size-5" strokeWidth={1.5} />

function EntryVisual({ entry }: { entry: Entry }) {
  switch (entry.kind) {
    case "niche":
      return (
        <NicheAvatar
          slug={entry.preset.slug}
          name={entry.preset.name}
          palette={entry.preset.palette}
          imageUrl={entry.preset.imageUrl}
          size="sm"
        />
      )
    case "artist":
      return (
        <Thumb src={entry.artist.imageUrl} round>
          {icon(Mic2)}
        </Thumb>
      )
    case "brand":
      return <Thumb>{icon(Tag)}</Thumb>
    case "track":
      return <Thumb src={entry.track.artworkUrl}>{icon(Play)}</Thumb>
    case "fit":
      return <Thumb src={entry.fit.imageUrl} />
    case "headline":
      return <Thumb src={entry.headline.imageUrl}>{icon(Newspaper)}</Thumb>
    case "page":
      return <Thumb round>{icon(entry.page === "explore" ? Compass : Sparkles)}</Thumb>
    case "summon":
      return <Thumb round>{icon(Wand2)}</Thumb>
    case "query":
      return <Thumb round>{icon(entry.group === "Trending" ? TrendingUp : Clock)}</Thumb>
  }
}

/**
 * ⌘K / Ctrl+K: search everything. Niches, artists, brands (with live
 * listings and an alert shortcut), playable tracks, fits and headlines,
 * plus recent and trending searches. Or summon a brand-new niche.
 */
export function CommandPalette({ presets }: { presets: readonly NichePreset[] }) {
  const router = useRouter()
  // Marked first, so closing the palette doesn't step back over the navigation.
  const go = (href: string) => {
    markNavigation()
    router.push(href)
  }
  const [open, setOpen] = useState(false)
  useOverlay(open, () => setOpen(false))
  const visibleHeight = useVisibleHeight()
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const [status, setStatus] = useState<string | null>(null)
  const [alertFor, setAlertFor] = useState<{ slug: string; name: string } | null>(null)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const { results, loading, trending, recent, remember } = useSearch(open, query)

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener("keydown", onKey)
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen)
    }
  }, [])

  const entries = useMemo(
    () => buildEntries({ query, presets, results, recent, trending }),
    [query, presets, results, recent, trending],
  )

  function close() {
    setOpen(false)
    setQuery("")
    setActive(0)
    setStatus(null)
    setAlertFor(null)
  }

  async function summon(text: string) {
    setStatus("Summoning…")
    try {
      const response = await fetch("/api/niches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: text }),
      })
      const body = (await response.json()) as ApiResponse<{ slug: string }>
      if (body.success) {
        go(`/n/${body.data.slug}`)
        close()
      } else setStatus(body.error)
    } catch {
      setStatus("Couldn't reach the server. Try again.")
    }
  }

  function run(entry: Entry) {
    if (entry.kind === "query") {
      setQuery(entry.query)
      setActive(0)
      return
    }
    if (entry.kind === "summon") {
      void summon(entry.query)
      return
    }
    if (query.trim()) remember(query)
    switch (entry.kind) {
      case "niche":
        logSearch("niche", entry.preset.slug)
        go(`/n/${entry.preset.slug}`)
        break
      case "page":
        go(entry.href)
        break
      case "artist":
        logSearch("artist", entry.artist.slug)
        setSheet({ kind: "artist", artist: entry.artist })
        break
      case "brand":
        logSearch("brand", entry.brand.slug)
        setSheet({ kind: "brand", brand: entry.brand })
        break
      case "track": {
        const tracks = (results?.tracks ?? []).map((t) => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          artworkUrl: t.artworkUrl,
          previewUrl: t.previewUrl,
          appleUrl: t.appleUrl,
          spotifyUrl: null,
        }))
        void playTracks(tracks, entry.index, "Search")
        break
      }
      case "fit":
        go(`/fits/${entry.fit.id}`)
        break
      case "headline":
        window.open(entry.headline.url, "_blank", "noopener,noreferrer")
        break
    }
    close()
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((index) => Math.min(index + 1, entries.length - 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, 0))
    } else if (event.key === "Enter" && entries[active]) {
      event.preventDefault()
      run(entries[active])
    }
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-(--z-sheet) bg-black/50 backdrop-blur-sm transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
          <Dialog.Popup className="fixed top-[10vh] left-1/2 z-(--z-sheet) w-[min(94vw,40rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-elevated shadow-pop transition-[opacity,scale] duration-150 outline-none data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0">
            <Dialog.Title className="sr-only">Search subcult</Dialog.Title>
            <div className="flex items-center gap-3 border-b border-border px-4">
              {loading ? (
                <Loader2 aria-hidden className="size-5 animate-spin text-muted-foreground" />
              ) : (
                <Search aria-hidden className="size-5 text-muted-foreground" strokeWidth={1.5} />
              )}
              <input
                autoFocus
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActive(0)
                  setStatus(null)
                  setAlertFor(null)
                }}
                onKeyDown={onKeyDown}
                placeholder="Search niches, artists, brands, tracks, fits…"
                aria-label="Search subcult"
                aria-activedescendant={entries[active] ? `cmd-${entries[active].id}` : undefined}
                aria-controls="cmd-results"
                className="h-14 min-w-0 flex-1 bg-transparent text-headline outline-none placeholder:text-subtle"
              />
              <kbd className="rounded-md border border-border px-1.5 text-caption text-muted-foreground">
                esc
              </kbd>
            </div>
            <ul
              id="cmd-results"
              role="listbox"
              className="max-h-[60vh] overflow-y-auto overscroll-contain p-2"
              // On phones the keyboard covers the bottom of the screen: the list ends above it.
              style={
                visibleHeight
                  ? { maxHeight: `min(60vh, calc(${visibleHeight}px - 10vh - 5.5rem))` }
                  : undefined
              }
            >
              {entries.map((entry, index) => (
                <li key={entry.id} role="presentation">
                  {index === 0 || entries[index - 1]?.group !== entry.group ? (
                    <p
                      role="presentation"
                      className="px-3 pt-3 pb-1 text-caption font-semibold tracking-[0.15em] text-muted-foreground uppercase"
                    >
                      {entry.group}
                    </p>
                  ) : null}
                  <div
                    id={`cmd-${entry.id}`}
                    role="option"
                    aria-selected={index === active}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => run(entry)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2",
                      index === active && "bg-muted",
                    )}
                  >
                    <EntryVisual entry={entry} />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate",
                          entry.kind === "niche"
                            ? "font-serif text-title-3 italic"
                            : "text-body font-medium",
                        )}
                      >
                        {entry.label}
                      </span>
                      <span className="block truncate text-footnote text-muted-foreground">
                        {entry.hint}
                      </span>
                    </span>
                    {entry.kind === "brand" ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setAlertFor(entry.brand)
                        }}
                        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-border-strong px-3 text-caption font-semibold hover:bg-background"
                      >
                        <Bell aria-hidden className="size-3.5" strokeWidth={1.75} />
                        Alert me
                      </button>
                    ) : index === active ? (
                      <CornerDownLeft
                        aria-hidden
                        className="size-4 shrink-0 text-muted-foreground"
                        strokeWidth={1.5}
                      />
                    ) : null}
                  </div>
                </li>
              ))}
              {query.trim().length >= 2 && !loading && results && entries.length === 0 ? (
                <li className="px-3 py-6 text-center text-callout text-muted-foreground">
                  Nothing found for “{query.trim()}”.
                </li>
              ) : null}
            </ul>
            {alertFor ? (
              <div className="border-t border-border">
                <GrailAlertForm brand={alertFor} onDone={() => setAlertFor(null)} />
              </div>
            ) : null}
            {status ? (
              <p
                role="status"
                className="border-t border-border px-4 py-3 text-footnote text-muted-foreground"
              >
                {status}
              </p>
            ) : null}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      {sheet?.kind === "artist" ? (
        <ArtistSheet artist={sheet.artist} onClose={() => setSheet(null)} />
      ) : sheet?.kind === "brand" ? (
        <BrandSheet brand={sheet.brand} onClose={() => setSheet(null)} />
      ) : null}
    </>
  )
}
