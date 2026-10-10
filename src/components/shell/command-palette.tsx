"use client"

import { Dialog } from "@base-ui/react/dialog"
import { ArrowRight, Compass, CornerDownLeft, Search, Sparkles, Wand2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { type KeyboardEvent, useEffect, useMemo, useState } from "react"
import { NicheAvatar } from "@/components/ds/niche-avatar"
import type { NichePreset } from "@/lib/niches/catalog"
import type { ApiResponse } from "@/lib/request"
import { cn } from "@/lib/utils"
import { OPEN_SEARCH_EVENT } from "./nav"

type Entry =
  | { kind: "niche"; id: string; label: string; hint: string; preset: NichePreset }
  | { kind: "page"; id: string; label: string; hint: string; href: string; icon: typeof Compass }
  | { kind: "summon"; id: string; label: string; hint: string; query: string }

const PAGES: Entry[] = [
  {
    kind: "page",
    id: "p-explore",
    label: "Explore",
    hint: "Every niche",
    href: "/explore",
    icon: Compass,
  },
  {
    kind: "page",
    id: "p-vibe",
    label: "Take the vibe check",
    hint: "12 swipes",
    href: "/vibe-check",
    icon: Sparkles,
  },
]

const MAX_NICHES = 8

/** ⌘K / Ctrl+K: jump to any niche or page, or summon a brand-new niche. */
export function CommandPalette({ presets }: { presets: readonly NichePreset[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const [status, setStatus] = useState<string | null>(null)

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

  const entries = useMemo<Entry[]>(() => {
    const needle = query.trim().toLowerCase()
    const niches = presets
      .filter((preset) => !needle || preset.name.includes(needle))
      .slice(0, MAX_NICHES)
      .map<Entry>((preset) => ({
        kind: "niche",
        id: preset.slug,
        label: preset.name,
        hint: preset.tagline,
        preset,
      }))
    const pages = PAGES.filter((page) => !needle || page.label.toLowerCase().includes(needle))
    const summon: Entry[] =
      needle.length >= 2 && !presets.some((preset) => preset.name === needle)
        ? [
            {
              kind: "summon",
              id: "summon",
              label: `Summon “${query.trim()}”`,
              hint: "Generate a new niche",
              query: query.trim(),
            },
          ]
        : []
    return [...niches, ...summon, ...pages]
  }, [presets, query])

  function close() {
    setOpen(false)
    setQuery("")
    setActive(0)
    setStatus(null)
  }

  async function run(entry: Entry) {
    if (entry.kind === "niche") {
      router.push(`/n/${entry.preset.slug}`)
      close()
    } else if (entry.kind === "page") {
      router.push(entry.href)
      close()
    } else {
      setStatus("Summoning…")
      try {
        const response = await fetch("/api/niches", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: entry.query }),
        })
        const body = (await response.json()) as ApiResponse<{ slug: string }>
        if (body.success) {
          router.push(`/n/${body.data.slug}`)
          close()
        } else {
          setStatus(body.error)
        }
      } catch {
        setStatus("Couldn't reach the server. Try again.")
      }
    }
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
      void run(entries[active])
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed top-[12vh] left-1/2 z-50 w-[min(92vw,36rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-elevated shadow-pop transition-[opacity,scale] duration-150 outline-none data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0">
          <Dialog.Title className="sr-only">Search subcult</Dialog.Title>
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search aria-hidden className="size-5 text-muted-foreground" strokeWidth={1.5} />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActive(0)
                setStatus(null)
              }}
              onKeyDown={onKeyDown}
              placeholder="Search any vibe…"
              aria-label="Search niches"
              aria-activedescendant={entries[active] ? `cmd-${entries[active].id}` : undefined}
              aria-controls="cmd-results"
              className="h-14 flex-1 bg-transparent text-headline outline-none placeholder:text-subtle"
            />
            <kbd className="rounded-md border border-border px-1.5 text-caption text-muted-foreground">
              esc
            </kbd>
          </div>
          <ul id="cmd-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
            {entries.map((entry, index) => (
              <li
                key={entry.id}
                id={`cmd-${entry.id}`}
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => void run(entry)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5",
                  index === active && "bg-muted",
                )}
              >
                {entry.kind === "niche" ? (
                  <NicheAvatar
                    slug={entry.preset.slug}
                    name={entry.preset.name}
                    palette={entry.preset.palette}
                    size="sm"
                  />
                ) : (
                  <span className="grid size-11 place-items-center rounded-full bg-muted">
                    {entry.kind === "summon" ? (
                      <Wand2 aria-hidden className="size-5" strokeWidth={1.5} />
                    ) : (
                      <entry.icon aria-hidden className="size-5" strokeWidth={1.5} />
                    )}
                  </span>
                )}
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
                {index === active ? (
                  <CornerDownLeft
                    aria-hidden
                    className="size-4 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                ) : (
                  <ArrowRight aria-hidden className="size-4 text-transparent" />
                )}
              </li>
            ))}
          </ul>
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
  )
}
