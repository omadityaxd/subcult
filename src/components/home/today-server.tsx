import { cookies, headers } from "next/headers"
import type { ReactNode } from "react"
import { errorMessage, log } from "@/lib/log"
import { getViewer } from "@/lib/supabase/server"
import {
  PREVIOUS_VISIT_COOKIE,
  TASTE_COOKIE,
  TIME_ZONE_COOKIE,
  parsePreviousVisit,
  parseTasteCookie,
} from "@/lib/today/cookies"
import type { TodayEdition } from "@/lib/today/edition"
import { ISSUE_COOKIE, issueNumberFromCookie, localDay } from "@/lib/today/issues"
import { buildToday } from "@/lib/today/server"
import { Today } from "./today"

/** The masthead number: today's issue per the device's cookie, in the reader's day. */
function currentIssueNo(raw: string | undefined, timeZone: string): number {
  return issueNumberFromCookie(raw, localDay(Date.now(), timeZone))
}

/**
 * Today, rendered on the server and streamed (its own Suspense boundary):
 * no client round trip before the personal edition paints. Taste comes from
 * the cookie the device keeps in sync; time zone from the cookie, else
 * Vercel's IP time zone. On any failure the client fetches as before.
 */
export async function TodayServer({ coldExtras }: { coldExtras: ReactNode }) {
  const [jar, head] = await Promise.all([cookies(), headers()])
  const decode = (name: string) => {
    const raw = jar.get(name)?.value
    try {
      return raw ? decodeURIComponent(raw) : undefined
    } catch {
      return undefined
    }
  }
  const timeZone = decode(TIME_ZONE_COOKIE) ?? head.get("x-vercel-ip-timezone") ?? "UTC"
  const lastVisit = parsePreviousVisit(decode(PREVIOUS_VISIT_COOKIE))
  let initial: TodayEdition | null = null
  try {
    const viewer = await getViewer().catch(() => null)
    initial = await buildToday({
      entities: parseTasteCookie(decode(TASTE_COOKIE)),
      brands: [],
      lastVisit,
      timeZone,
      viewerId: viewer?.id ?? null,
    })
  } catch (error) {
    log.warn("today.ssr_failed", { error: errorMessage(error) })
  }
  const issueNo = currentIssueNo(decode(ISSUE_COOKIE), timeZone)
  return (
    <Today
      coldExtras={coldExtras}
      initial={initial ? { edition: initial, lastVisit, timeZone } : null}
      issueNo={issueNo}
    />
  )
}
