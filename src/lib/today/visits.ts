"use client"

import { PREVIOUS_VISIT_COOKIE, TIME_ZONE_COOKIE, writeCookie } from "./cookies"

/**
 * "Since you were here Tuesday": the start of the previous session. A new
 * session begins after 30 minutes away, so reloads don't reset the marker.
 */
const STORAGE_KEY = "subcult-visits-v1"
const SESSION_GAP_MS = 30 * 60_000

interface Visits {
  previous: number | null
  current: number
}

/** Call once per Today mount: returns the last session's start (null on a first visit). */
export function touchVisit(now = Date.now()): number | null {
  let visits: Visits | null = null
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")
    if (parsed && typeof parsed === "object" && "current" in parsed) visits = parsed as Visits
  } catch {
    visits = null
  }
  const next: Visits =
    visits && now - visits.current < SESSION_GAP_MS
      ? visits
      : { previous: visits?.current ?? null, current: now }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Not remembered: every visit is a first visit.
  }
  // The server renders the next Today from these.
  writeCookie(PREVIOUS_VISIT_COOKIE, next.previous ? String(next.previous) : "")
  writeCookie(TIME_ZONE_COOKIE, Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC")
  return next.previous
}
