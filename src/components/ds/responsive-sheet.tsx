"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { preloadWhenIdle } from "@/lib/ui/when-idle"
import type { ResponsiveSheetProps } from "./responsive-sheet-impl"

// The drawer and dialog libraries load when the page is idle, not with the first paint:
// every sheet starts closed.
const loadSheet = () => import("./responsive-sheet-impl").then((m) => m.ResponsiveSheetImpl)
const Sheet = dynamic(loadSheet, { ssr: false })
preloadWhenIdle(loadSheet)

/** Bottom sheet on phones (drag to dismiss), centered modal on tablet and desktop. */
export function ResponsiveSheet(props: ResponsiveSheetProps) {
  // Mounted from the first open on, so closing still animates out.
  const [used, setUsed] = useState(props.open)
  if (props.open && !used) setUsed(true)
  return used ? <Sheet {...props} /> : null
}
