"use client"

import { Heart } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { type ReactNode, useRef, useState } from "react"
import { gestures, springs } from "@/lib/design/tokens"
import { type SavedItem, setSaved } from "@/lib/saves"

interface DoubleTapSaveProps {
  item: Omit<SavedItem, "savedAt">
  children: ReactNode
  className?: string
}

/**
 * Instagram double-tap: two quick taps save (never unsave) and pop a heart.
 * Single taps still reach the link underneath; the double-tap's second click
 * is swallowed so it doesn't navigate.
 */
export function DoubleTapSave({ item, children, className }: DoubleTapSaveProps) {
  const lastTap = useRef(0)
  const [burst, setBurst] = useState(0)

  return (
    <div
      className={className}
      onClickCapture={(event) => {
        const now = Date.now()
        if (now - lastTap.current < gestures.doubleTapMs) {
          event.preventDefault()
          event.stopPropagation()
          lastTap.current = 0
          setSaved(item, true)
          setBurst((count) => count + 1)
          return
        }
        lastTap.current = now
      }}
    >
      <div className="relative">
        {children}
        <AnimatePresence>
          {burst > 0 ? (
            <motion.span
              key={burst}
              aria-hidden
              className="pointer-events-none absolute inset-0 grid place-items-center"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.15, 1, 1.1] }}
              transition={{ duration: 0.8, times: [0, 0.25, 0.7, 1] }}
              onAnimationComplete={() => setBurst(0)}
            >
              <motion.span transition={springs.pop}>
                <Heart
                  className="size-20 text-white drop-shadow-xl"
                  fill="currentColor"
                  strokeWidth={0}
                />
              </motion.span>
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}
