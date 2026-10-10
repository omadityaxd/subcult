"use client"

import { motion } from "motion/react"
import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react"
import { springs } from "@/lib/design/tokens"
import { cn } from "@/lib/utils"

export const NICHE_TABS = [
  { id: "for-you", label: "for you" },
  { id: "sounds", label: "sounds" },
  { id: "tea", label: "tea" },
  { id: "community", label: "community" },
  { id: "watch", label: "watch" },
  { id: "drip", label: "drip" },
  { id: "moodboard", label: "moodboard" },
] as const

export type NicheTabId = (typeof NICHE_TABS)[number]["id"]

interface NicheTabsProps {
  panels: Record<NicheTabId, ReactNode>
}

/** iOS segmented control (scrollable) pinned under the nav bar, plus its panels. */
export function NicheTabs({ panels }: NicheTabsProps) {
  const [active, setActive] = useState<NicheTabId>("for-you")
  const baseId = useId()
  const tabRefs = useRef<Map<NicheTabId, HTMLButtonElement>>(new Map())
  const stickyRef = useRef<HTMLDivElement>(null)

  function select(id: NicheTabId) {
    setActive(id)
    tabRefs.current
      .get(id)
      ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" })
    // If the user switched tabs while scrolled deep, bring the new panel's top into view.
    const bar = stickyRef.current
    if (bar && bar.getBoundingClientRect().top <= parseFloat(getComputedStyle(bar).top) + 1) {
      bar.scrollIntoView({ block: "start", behavior: "smooth" })
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = NICHE_TABS.findIndex((tab) => tab.id === active)
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const next = NICHE_TABS[(index + step + NICHE_TABS.length) % NICHE_TABS.length].id
    select(next)
    tabRefs.current.get(next)?.focus()
  }

  return (
    <>
      <div
        ref={stickyRef}
        className="sticky top-[calc(var(--nav-bar-height)+env(safe-area-inset-top))] z-20 glass hairline-b"
      >
        <div
          role="tablist"
          aria-label="Niche sections"
          onKeyDown={onKeyDown}
          className="no-scrollbar flex gap-1 overflow-x-auto px-4 py-2"
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
                  "relative shrink-0 rounded-full px-4 py-1.5 text-[15px] font-medium transition-colors",
                  selected ? "text-niche-foreground" : "text-muted-foreground",
                )}
              >
                {selected ? (
                  <motion.span
                    layoutId="niche-tab-pill"
                    transition={springs.snappy}
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-niche"
                  />
                ) : null}
                <span className="relative">{tab.label}</span>
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
        className="px-4 pt-5"
      >
        {panels[active]}
      </motion.div>
    </>
  )
}
