"use client"

import { CircleUser, Compass, Sparkles, type LucideIcon } from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { MouseEvent } from "react"
import { springs } from "@/lib/motion"
import { cn } from "@/lib/utils"

interface Tab {
  href: "/" | "/explore" | "/me"
  label: string
  icon: LucideIcon
  isActive: (pathname: string) => boolean
}

const TABS: readonly Tab[] = [
  { href: "/", label: "for you", icon: Sparkles, isActive: (p) => p === "/" },
  {
    href: "/explore",
    label: "explore",
    icon: Compass,
    isActive: (p) => p.startsWith("/explore") || p.startsWith("/n/"),
  },
  { href: "/me", label: "me", icon: CircleUser, isActive: (p) => p.startsWith("/me") },
]

export function TabBar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Main"
      style={{ viewTransitionName: "tab-bar" }}
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-(--column-width) glass pb-safe hairline-t"
    >
      <ul className="grid h-(--tab-bar-height) grid-cols-3">
        {TABS.map((tab) => (
          <li key={tab.href}>
            <TabLink tab={tab} active={tab.isActive(pathname)} isRoot={pathname === tab.href} />
          </li>
        ))}
      </ul>
    </nav>
  )
}

function TabLink({ tab, active, isRoot }: { tab: Tab; active: boolean; isRoot: boolean }) {
  const Icon = tab.icon

  // iOS convention: tapping the tab you're already on scrolls back to the top.
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isRoot) return
    event.preventDefault()
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <Link
      href={tab.href}
      transitionTypes={["tab-switch"]}
      onClick={handleClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium tracking-wide transition-colors",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {active ? (
        <motion.span
          layoutId="tab-indicator"
          transition={springs.snappy}
          aria-hidden
          className="absolute top-1.5 h-8 w-14 rounded-full bg-foreground/10"
        />
      ) : null}
      <motion.span whileTap={{ scale: 0.85 }} transition={springs.press} className="relative">
        <Icon aria-hidden className="size-6" strokeWidth={active ? 2.3 : 1.8} />
      </motion.span>
      <span className="relative">{tab.label}</span>
    </Link>
  )
}
