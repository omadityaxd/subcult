import { type TodayMode, localClock, todayMode } from "./edition"

/**
 * A first-time visitor's issue: no account, no taste yet, no saved brands,
 * no earlier visit. Every such visitor in the same time zone gets the same
 * edition, so it's built once and shared for a few minutes instead of
 * per request (it was ~3s of server work before the cover could paint).
 */
export interface GuestRequestShape {
  viewerId?: string | null
  entities: readonly unknown[]
  brands: readonly unknown[]
  lastVisit: number | null
  timeZone: string
  scopeNiche?: string
}

/** Fresh for 5 minutes; a stale copy is served for 15 if a rebuild fails. */
export const GUEST_ISSUE_POLICY = { freshSeconds: 5 * 60, staleSeconds: 15 * 60 }

export function isGuestRequest(req: GuestRequestShape): boolean {
  return (
    !req.viewerId &&
    req.entities.length === 0 &&
    req.brands.length === 0 &&
    req.lastVisit === null &&
    !req.scopeNiche
  )
}

function validZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0)
    return timeZone
  } catch {
    return "UTC"
  }
}

/**
 * One shared edition per time zone, local day and edition mode (morning,
 * day, night, weekend), so a reader never gets yesterday's or the wrong
 * time of day's issue from the cache.
 */
export function guestIssueKey(timeZone: string, now: number): string {
  const zone = validZone(timeZone)
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(now)
  const mode: TodayMode = todayMode(localClock(now, zone))
  return `subcult:today:guest:v1:${zone}:${day}:${mode}`
}
