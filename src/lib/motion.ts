import type { Transition } from "motion/react"

/** Shared spring presets so every interaction feels like the same physical system. */
export const springs = {
  /** Press-scale feedback on tappable surfaces. */
  press: { type: "spring", stiffness: 600, damping: 32, mass: 0.6 },
  /** Shared-layout moves like the tab bar indicator. */
  snappy: { type: "spring", stiffness: 500, damping: 38 },
  /** Larger surfaces: sheets, cards entering. */
  gentle: { type: "spring", stiffness: 260, damping: 30 },
} satisfies Record<string, Transition>

export const PRESS_SCALE = 0.97
