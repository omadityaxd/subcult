"use client"

import { motion } from "motion/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { MouseEvent } from "react"
import { springs } from "@/lib/design/tokens"
import { cn } from "@/lib/utils"
import { NAV_ITEMS, type NavItem } from "./nav"

/** Reads the URL, so it must sit inside <Suspense> on dynamic routes. */
export function TabBar() {
  return <TabBarView pathname={usePathname()} />
}

/**
 * Mobile bottom bar (hidden from 768px, where the sidebar takes over).
 * With `pathname={null}` it's the static Suspense fallback.
 */
export function TabBarView({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Main"
      style={{ viewTransitionName: "tab-bar" }}
      className="fixed inset-x-0 bottom-0 z-40 glass pb-safe hairline-t md:hidden"
    >
      <ul className="mx-auto grid h-(--tab-bar-height) max-w-md grid-cols-4">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <TabLink
              item={item}
              active={pathname !== null && item.isActive(pathname)}
              isRoot={pathname === item.href}
            />
          </li>
        ))}
      </ul>
    </nav>
  )
}

function TabLink({ item, active, isRoot }: { item: NavItem; active: boolean; isRoot: boolean }) {
  const Icon = item.icon
  // iOS convention: tapping the tab you're on scrolls back to the top.
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isRoot) return
    event.preventDefault()
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  return (
    <Link
      href={item.href}
      transitionTypes={["tab-switch"]}
      onClick={handleClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-full flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
        active ? "text-foreground" : "text-subtle",
      )}
    >
      <motion.span whileTap={{ scale: 0.85 }} transition={springs.press}>
        <Icon aria-hidden className="size-[22px]" strokeWidth={active ? 2 : 1.5} />
      </motion.span>
      <span>{item.label}</span>
      {active ? (
        <motion.span
          layoutId="tab-dot"
          transition={springs.snappy}
          aria-hidden
          className="absolute top-1 size-1 rounded-full bg-foreground"
        />
      ) : null}
    </Link>
  )
}
