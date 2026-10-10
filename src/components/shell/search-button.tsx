"use client"

import type { ReactNode } from "react"
import { OPEN_SEARCH_EVENT } from "./nav"

/** Opens the ⌘K search palette (used on phones, where there's no sidebar). */
export function SearchButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label="Search"
      onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))}
      className="grid size-10 place-items-center rounded-full hover:bg-muted"
    >
      {children}
    </button>
  )
}
