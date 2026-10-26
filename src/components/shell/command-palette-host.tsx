"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import type { NichePreset } from "@/lib/niches/catalog"
import { whenIdle } from "@/lib/ui/when-idle"
import { OPEN_SEARCH_EVENT } from "./nav"

const CommandPalette = dynamic(() => import("./command-palette").then((m) => m.CommandPalette), {
  ssr: false,
})

/**
 * Search's code (results, sheets, alerts) stays out of the first paint. This
 * host listens for ⌘K and the search buttons from the start; the palette
 * itself mounts when the page is idle, or at once if someone asks first.
 */
export function CommandPaletteHost({ presets }: { presets: readonly NichePreset[] }) {
  const [mount, setMount] = useState<"waiting" | "idle" | "asked">("waiting")

  useEffect(() => {
    if (mount !== "waiting") return
    const ask = () => setMount("asked")
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        ask()
      }
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener(OPEN_SEARCH_EVENT, ask)
    whenIdle(() => setMount((current) => (current === "waiting" ? "idle" : current)))
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener(OPEN_SEARCH_EVENT, ask)
    }
  }, [mount])

  if (mount === "waiting") return null
  return <CommandPalette presets={presets} defaultOpen={mount === "asked"} />
}
