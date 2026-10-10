import type { Transition } from "motion/react"

/**
 * JS-side design tokens. Color, type, radius, shadows and CSS durations live
 * in globals.css (@theme); this file holds what JavaScript needs: springs,
 * gesture thresholds and breakpoints. Keep the two in sync.
 */

/** Spring presets so every interaction feels like the same physical system. */
export const springs = {
  /** Press-scale feedback on tappable surfaces. */
  press: { type: "spring", stiffness: 600, damping: 32, mass: 0.6 },
  /** Shared-layout moves: tab indicators, segmented controls. */
  snappy: { type: "spring", stiffness: 520, damping: 40 },
  /** Larger surfaces: sheets, cards entering, story transitions. */
  gentle: { type: "spring", stiffness: 260, damping: 30 },
  /** Bouncy celebration: the double-tap heart, result reveals. */
  pop: { type: "spring", stiffness: 420, damping: 14, mass: 0.8 },
} satisfies Record<string, Transition>

export const PRESS_SCALE = 0.97

/** Mirrors the Tailwind breakpoints used for real per-device layouts. */
export const breakpoints = {
  tablet: 768,
  desktop: 1024,
  wide: 1280,
} as const

export const gestures = {
  /** Two taps within this window count as a double-tap (save). */
  doubleTapMs: 280,
  /** Hold this long for a peek preview on touch. */
  longPressMs: 450,
  /** Horizontal swipe distance that switches tabs. */
  swipeTabPx: 64,
  /** Downward drag that dismisses a story / sheet. */
  dismissPx: 120,
  /** Pull distance that triggers refresh. */
  pullRefreshPx: 72,
} as const

/** Story viewer timing. */
export const STORY_ITEM_MS = 5_000
