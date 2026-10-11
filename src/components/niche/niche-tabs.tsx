"use client"

import { motion, type PanInfo } from "motion/react"
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"
import { gestures, springs } from "@/lib/design/tokens"
import { useNicheUi } from "@/lib/niches/niche-ui-store"
import { cn } from "@/lib/utils"

/** Culture first: fits and archive ahead of sounds; news, video and community live in Scene. */
export const NICHE_TABS = [
  { id: "for-you", label: "For you" },
  { id: "fits", label: "Fits" },
  { id: "archive", label: "Archive" },
  { id: "sounds", label: "Sounds" },
  { id: "moodboard", label: "Moodboard" },
  { id: "scene", label: "Scene" },
] as const

export type NicheTabId = (typeof NICHE_TABS)[number]["id"]

interface NicheTabsProps {
  panels: Record<NicheTabId, ReactNode>
  /** Fashion niches open on Fits; music niches on the mixed For you. */
  initialTab?: NicheTabId
}

/**
 * Sticky underline segmented control + panels. On touch screens a horizontal
 * swipe on the content moves between tabs; vertical scrolling is untouched.
 */
export function NicheTabs({ panels, initialTab = "for-you" }: NicheTabsProps) {
  const [active, setActive] = useState<NicheTabId>(initialTab)
  const baseId = useId()
  const tabRefs = useRef<Map<NicheTabId, HTMLButtonElement>>(new Map())
  const stickyRef = useRef<HTMLDivElement>(null)
  const pointerType = useRef<string>("mouse")

  function select(id: NicheTabId) {
    setActive(id)
    tabRefs.current
      .get(id)
      ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" })
    const bar = stickyRef.current
    if (bar && bar.getBoundingClientRect().top <= parseFloat(getComputedStyle(bar).top) + 1) {
      bar.scrollIntoView({ block: "start", behavior: "smooth" })
    }
  }

  // Other parts of the page can switch tabs ("shop this color" → the shop).
  const { requestedTab } = useNicheUi()
  useEffect(() => {
    const id = NICHE_TABS.find((tab) => tab.id === requestedTab?.id)?.id
    // An external request is an event, not derived state: apply it once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (id) select(id)
  }, [requestedTab])

  function step(direction: 1 | -1) {
    const index = NICHE_TABS.findIndex((tab) => tab.id === active)
    const next = NICHE_TABS[index + direction]
    if (next) select(next.id)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
    if (direction === 0) return
    event.preventDefault()
    const index = NICHE_TABS.findIndex((tab) => tab.id === active)
    const next = NICHE_TABS[(index + direction + NICHE_TABS.length) % NICHE_TABS.length].id
    select(next)
    tabRefs.current.get(next)?.focus()
  }

  function onPanEnd(_event: unknown, info: PanInfo) {
    if (pointerType.current !== "touch") return
    const { x, y } = info.offset
    if (Math.abs(x) < gestures.swipeTabPx || Math.abs(y) > Math.abs(x) * 0.6) return
    step(x < 0 ? 1 : -1)
  }

  return (
    <>
      <div
        ref={stickyRef}
        className="sticky top-0 z-20 -mx-(--gutter) bg-background/85 pt-safe backdrop-blur-xl lg:mx-0"
      >
        <div
          role="tablist"
          aria-label="Niche sections"
          onKeyDown={onKeyDown}
          className="no-scrollbar flex gap-6 overflow-x-auto border-b border-border px-(--gutter) lg:px-0"
        >
          {NICHE_TABS.map((tab) => {
            const selected = tab.id === active
            return (
              <button
                key={tab.id}
                ref={(node) => {
                  if (node) tabRefs.current.set(tab.id, node)
                  else tabRefs.current.delete(tab.id)
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(tab.id)}
                className={cn(
                  "relative shrink-0 py-3.5 text-callout font-medium transition-colors",
                  selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                {selected ? (
                  <motion.span
                    layoutId="niche-tab-underline"
                    transition={springs.snappy}
                    aria-hidden
                    className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-niche"
                  />
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      <motion.div
        key={active}
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${active}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.gentle}
        onPointerDown={(event: PointerEvent) => {
          pointerType.current = event.pointerType
        }}
        onPanEnd={onPanEnd}
        style={{ touchAction: "pan-y" }}
        className="pt-8"
      >
        {panels[active]}
      </motion.div>
    </>
  )
}
