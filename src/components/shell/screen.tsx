import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { PageTransition } from "./page-transition"

interface ScreenProps {
  children: ReactNode
  /** Reserve space for the floating tab bar. Off for full-screen flows. */
  withTabBar?: boolean
  className?: string
}

export function Screen({ children, withTabBar = true, className }: ScreenProps) {
  return (
    <PageTransition>
      <main className={cn("min-h-dvh", withTabBar ? "pb-tab-bar" : "pb-safe", className)}>
        {children}
      </main>
    </PageTransition>
  )
}
