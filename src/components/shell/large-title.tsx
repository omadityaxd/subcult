"use client"

import { motion, useScroll, useTransform } from "motion/react"
import type { ReactNode } from "react"

interface LargeTitleProps {
  title: string
  subtitle?: string
  overline?: string
  trailing?: ReactNode
}

const COLLAPSE_START = 40
const COLLAPSE_END = 72

/**
 * Editorial page header: overline + serif display title. On phones a compact
 * frosted bar fades in once the big title scrolls away (iOS large title).
 */
export function LargeTitle({ title, subtitle, overline, trailing }: LargeTitleProps) {
  const { scrollY } = useScroll()
  const compactOpacity = useTransform(scrollY, [COLLAPSE_START, COLLAPSE_END], [0, 1])

  return (
    <>
      <motion.header
        aria-hidden
        style={{ opacity: compactOpacity }}
        className="pointer-events-none fixed inset-x-0 top-0 z-30 pt-safe md:hidden"
      >
        <div className="grid h-(--nav-bar-height) place-items-center glass hairline-b">
          <span className="text-headline font-semibold">{title}</span>
        </div>
      </motion.header>
      <div className="container-page flex items-end justify-between gap-4 pt-[calc(env(safe-area-inset-top)+2.5rem)] pb-6 md:pt-14 md:pb-8">
        <div className="min-w-0">
          {overline ? (
            <p className="mb-2 text-overline font-medium text-muted-foreground uppercase">
              {overline}
            </p>
          ) : null}
          <h1 className="font-serif text-title-1 italic">{title}</h1>
          {subtitle ? <p className="mt-2 text-callout text-muted-foreground">{subtitle}</p> : null}
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
    </>
  )
}
