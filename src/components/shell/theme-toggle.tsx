"use client"

import { Moon, Sun } from "lucide-react"
import { motion } from "motion/react"
import { useSyncExternalStore } from "react"
import { springs } from "@/lib/design/tokens"
import { THEME_STORAGE_KEY, type ThemeMode } from "@/lib/theme"
import { cn } from "@/lib/utils"

const OPTIONS: readonly { mode: ThemeMode; label: string; icon: typeof Moon }[] = [
  { mode: "dark", label: "dark", icon: Moon },
  { mode: "light", label: "light", icon: Sun },
]

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  return () => observer.disconnect()
}

const readMode = (): ThemeMode =>
  document.documentElement.classList.contains("dark") ? "dark" : "light"

function applyMode(mode: ThemeMode): void {
  document.documentElement.classList.toggle("dark", mode === "dark")
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // Private mode / blocked storage: the choice just won't persist across visits.
  }
}

/** Segmented dark/light switch. Source of truth is the class on <html>. */
export function ThemeToggle() {
  const mode = useSyncExternalStore(subscribe, readMode, () => "dark" as const)

  return (
    <div role="radiogroup" aria-label="Appearance" className="flex rounded-full bg-muted p-1">
      {OPTIONS.map(({ mode: option, label, icon: Icon }) => {
        const selected = option === mode
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => applyMode(option)}
            className={cn(
              "relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              selected ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {selected ? (
              <motion.span
                layoutId="theme-thumb"
                transition={springs.snappy}
                aria-hidden
                className="absolute inset-0 rounded-full bg-elevated shadow-sm"
              />
            ) : null}
            <Icon aria-hidden className="relative size-3.5" />
            <span className="relative">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
