"use client"

import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { NAV_ITEMS, OPEN_SEARCH_EVENT } from "./nav"
import { NotificationBell } from "@/components/alerts/notification-bell"
import { LegalLinks } from "./legal-links"
import { ThemeToggle } from "./theme-toggle"

/** Reads the URL, so it must sit inside <Suspense> on dynamic routes. */
export function Sidebar() {
  return <SidebarView pathname={usePathname()} />
}

/**
 * Instagram-web-style left nav. 768–1279px: a 72px icon rail that can expand
 * over the content (tablet "collapsible side rail"). ≥1280px: full sidebar
 * with labels. Hidden on phones (the bottom tab bar takes over).
 */
export function SidebarView({ pathname }: { pathname: string | null }) {
  const [expanded, setExpanded] = useState(false)
  const showLabels = expanded ? "inline" : "hidden xl:inline"

  return (
    <aside
      style={{ viewTransitionName: "sidebar" }}
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-background py-6 transition-[width] duration-300 ease-out md:flex",
        expanded ? "w-(--sidebar-width) shadow-pop" : "w-(--rail-width) xl:w-(--sidebar-width)",
      )}
    >
      <Link
        href="/"
        className="mb-8 flex h-10 items-center px-6 font-serif text-[28px] leading-none italic"
        aria-label="subcult home"
      >
        <span className={cn(expanded ? "hidden" : "xl:hidden")}>s</span>
        <span className={showLabels}>subcult</span>
      </Link>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-3">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))}
          className="flex h-12 items-center gap-4 rounded-xl px-3 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Search aria-hidden className="size-6 shrink-0" strokeWidth={1.5} />
          <span className={cn("flex-1 text-left text-body", showLabels)}>Search</span>
          <kbd className={cn("rounded-md border border-border px-1.5 text-caption", showLabels)}>
            ⌘K
          </kbd>
        </button>
        {NAV_ITEMS.map((item) => {
          const active = pathname !== null && item.isActive(pathname)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              transitionTypes={["tab-switch"]}
              aria-current={active ? "page" : undefined}
              title={item.label}
              onClick={() => setExpanded(false)}
              className={cn(
                "flex h-12 items-center gap-4 rounded-xl px-3 transition-colors hover:bg-muted",
                active
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon aria-hidden className="size-6 shrink-0" strokeWidth={active ? 2 : 1.5} />
              <span className={cn("text-body", showLabels)}>{item.label}</span>
            </Link>
          )
        })}
        <NotificationBell
          withLabel
          labelClassName={showLabels}
          className="h-12 rounded-xl px-3 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        />
      </nav>

      <div className="flex flex-col gap-3 px-3">
        <div className={cn("px-1", showLabels)}>
          <ThemeToggle />
        </div>
        <LegalLinks className={cn("px-2", showLabels)} />
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={expanded}
          className="flex h-12 items-center gap-4 rounded-xl px-3 text-muted-foreground hover:bg-muted hover:text-foreground xl:hidden"
        >
          {expanded ? (
            <PanelLeftClose aria-hidden className="size-6" strokeWidth={1.5} />
          ) : (
            <PanelLeftOpen aria-hidden className="size-6" strokeWidth={1.5} />
          )}
        </button>
      </div>
    </aside>
  )
}
