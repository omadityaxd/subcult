"use client"

import { ArrowDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { type ReactNode, type TouchEvent, useRef, useState, useTransition } from "react"
import { gestures } from "@/lib/design/tokens"
import { cn } from "@/lib/utils"

const MAX_PULL = 120
const RESISTANCE = 0.5

/**
 * Pull-to-refresh for touch screens: drag down from the top to re-render the
 * page's server components (feeds come back fresh or from cache). No spinner:
 * the indicator pulses while the refresh is in flight.
 */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [pull, setPull] = useState(0)
  const [isPending, startTransition] = useTransition()
  const startY = useRef<number | null>(null)

  const onTouchStart = (event: TouchEvent) => {
    startY.current = window.scrollY <= 0 ? event.touches[0].clientY : null
  }
  const onTouchMove = (event: TouchEvent) => {
    if (startY.current === null) return
    const distance = event.touches[0].clientY - startY.current
    setPull(distance > 0 ? Math.min(distance * RESISTANCE, MAX_PULL) : 0)
  }
  const onTouchEnd = () => {
    if (pull >= gestures.pullRefreshPx) startTransition(() => router.refresh())
    startY.current = null
    setPull(0)
  }

  const visible = pull > 8 || isPending
  const progress = Math.min(pull / gestures.pullRefreshPx, 1)

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        aria-hidden={!isPending}
        role="status"
        className={cn(
          "pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 flex justify-center transition-opacity md:hidden",
          visible ? "opacity-100" : "opacity-0",
        )}
        style={{ transform: `translateY(${isPending ? 8 : pull * 0.4}px)` }}
      >
        <span
          className={cn(
            "grid size-9 place-items-center rounded-full bg-elevated shadow-pop",
            isPending && "animate-pulse",
          )}
        >
          <ArrowDown
            className="size-4 transition-transform"
            strokeWidth={1.75}
            style={{
              transform: `rotate(${progress >= 1 || isPending ? 180 : 0}deg)`,
              opacity: 0.4 + progress * 0.6,
            }}
          />
          <span className="sr-only">{isPending ? "Refreshing" : ""}</span>
        </span>
      </div>
      {children}
    </div>
  )
}
