import { z } from "zod"

/** evergreen: curated or user-made, never expires. trending: found by the trend engine, expires. */
export const NICHE_KINDS = ["evergreen", "trending"] as const
export type NicheKind = (typeof NICHE_KINDS)[number]

/** archived: expired trend, still reachable by URL but off Explore. hidden: removed by admin. */
export const NICHE_STATUSES = ["active", "archived", "hidden"] as const
export type NicheStatus = (typeof NICHE_STATUSES)[number]

/** Evidence that a trending niche is real: an article, video or page that discusses it. */
export const trendSourceSchema = z.object({
  url: z.url(),
  title: z.string().min(1).max(300),
})
export type TrendSource = z.infer<typeof trendSourceSchema>

export const NEW_BADGE_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

/** Drives the 🔥 "new" badge on Explore cards and niche pages. */
export function isNew(publishedAt: Date, now: Date = new Date()): boolean {
  const age = now.getTime() - publishedAt.getTime()
  return age >= 0 && age < NEW_BADGE_DAYS * DAY_MS
}
