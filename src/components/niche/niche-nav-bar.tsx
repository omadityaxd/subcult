"use client"

import { ChevronLeft } from "lucide-react"
import { motion, useScroll, useTransform } from "motion/react"
import Link from "next/link"

interface NicheNavBarProps {
  name: string
  emoji: string
}

/** Scroll distance over which the compact title replaces the hero. */
const FADE_START = 200
const FADE_END = 260

/** Transparent over the hero, frosted with the niche name once you scroll past it. */
export function NicheNavBar({ name, emoji }: NicheNavBarProps) {
  const { scrollY } = useScroll()
  const opacity = useTransform(scrollY, [FADE_START, FADE_END], [0, 1])

  return (
    <header className="sticky top-0 z-30 pt-safe">
      <motion.div aria-hidden style={{ opacity }} className="absolute inset-0 glass hairline-b" />
      <div className="relative grid h-(--nav-bar-height) grid-cols-[2.25rem_1fr_2.25rem] items-center gap-2 px-4">
        <Link
          href="/explore"
          transitionTypes={["nav-back"]}
          aria-label="Back to explore"
          className="grid size-9 place-items-center rounded-full glass"
        >
          <ChevronLeft aria-hidden className="size-6" strokeWidth={2.2} />
        </Link>
        <motion.span
          aria-hidden
          style={{ opacity }}
          className="truncate text-center text-[17px] font-semibold"
        >
          {emoji} {name}
        </motion.span>
      </div>
    </header>
  )
}
