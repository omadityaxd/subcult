import { ViewTransition, type ReactNode } from "react"

export type NavTransitionType = "nav-forward" | "nav-back" | "tab-switch"

const BY_TYPE = {
  "nav-forward": "nav-forward",
  "nav-back": "nav-back",
  "tab-switch": "tab-switch",
  default: "none",
} satisfies Record<NavTransitionType | "default", string>

/**
 * Wrap each page (not layout — layouts persist, so enter/exit never fire there).
 * Links opt into a direction via `transitionTypes`; untyped navigations
 * (browser back, refresh) swap instantly.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={BY_TYPE} exit={BY_TYPE} default="none">
      {children}
    </ViewTransition>
  )
}
