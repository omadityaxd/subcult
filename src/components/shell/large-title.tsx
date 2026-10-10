"use client"

import { motion, useScroll, useTransform } from "motion/react"
import type { ReactNode } from "react"

interface LargeTitleProps {
  title: string
  subtitle?: string
  leading?: ReactNode
  trailing?: ReactNode
}

/** Distance (px) over which the large title hands off to the compact nav bar. */
const COLLAPSE_START = 28
const COLLAPSE_END = 52

/**
 * iOS large-title nav bar: a big display title that scrolls away while a
 * compact, frosted bar fades in at the top.
 */
export function LargeTitle({ title, subtitle, leading, trailing }: LargeTitleProps) {
  const { scrollY } = useScroll()
  const compactOpacity = useTransform(scrollY, [COLLAPSE_START, COLLAPSE_END], [0, 1])
  const largeOpacity = useTransform(scrollY, [0, COLLAPSE_END], [1, 0])

  return (
    <>
      <header className="sticky top-0 z-30 pt-safe">
        <motion.div
          aria-hidden
          style={{ opacity: compactOpacity }}
          className="absolute inset-0 glass hairline-b"
        />
        <div className="relative grid h-(--nav-bar-height) grid-cols-[1fr_auto_1fr] items-center px-4">
          <div className="justify-self-start">{leading}</div>
          <motion.span
            aria-hidden
            style={{ opacity: compactOpacity }}
            className="truncate text-[17px] font-semibold"
          >
            {title}
          </motion.span>
          <div className="justify-self-end">{trailing}</div>
        </div>
      </header>
      <motion.div style={{ opacity: largeOpacity }} className="px-4 pt-1 pb-4">
        <h1 className="font-display text-[34px] leading-[1.05] font-bold tracking-tight">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 text-[15px] text-muted-foreground">{subtitle}</p> : null}
      </motion.div>
    </>
  )
}
