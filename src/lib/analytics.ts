"use client"

import type { PostHog, PostHogConfig } from "posthog-js"

/**
 * Product analytics + error tracking (PostHog, free tier: 1M events and
 * 100k exceptions a month). Privacy-lean on purpose: no autocapture (it
 * reads element text), no session recording, no emails or handles sent;
 * only the explicit funnel events below. Off when the key is unset.
 */
export type AnalyticsEvent =
  | "onboarding_started"
  | "onboarding_completed"
  | "today_viewed"
  | "today_caught_up"
  | "alert_opt_in"
  | "grail_hunt_saved"
  | "vibe_check_completed"
  | "vibe_match_shared"
  | "fit_posted"

let started = false
let client: PostHog | null = null
const queue: ((ph: PostHog) => void)[] = []

const withClient = (fn: (ph: PostHog) => void) => {
  if (client) fn(client)
  else if (started) queue.push(fn)
}

/** Loads PostHog after the page is idle: it never competes with first paint. */
export function initAnalytics(key: string | undefined, host: string | undefined): void {
  if (started || !key || typeof window === "undefined") return
  started = true
  const load = () =>
    void import("posthog-js")
      .then(({ default: posthog }) => {
        posthog.init(key, analyticsConfig(host))
        client = posthog
        for (const fn of queue.splice(0)) fn(posthog)
      })
      .catch(() => undefined)
  if ("requestIdleCallback" in window) window.requestIdleCallback(load, { timeout: 4000 })
  else setTimeout(load, 2000)
}

function analyticsConfig(host: string | undefined): Partial<PostHogConfig> {
  return {
    api_host: host ?? "https://us.i.posthog.com",
    autocapture: false,
    capture_pageview: "history_change",
    capture_pageleave: true,
    disable_session_recording: true,
    capture_exceptions: true,
    person_profiles: "identified_only",
    persistence: "localStorage",
  }
}

/** Funnel step. Properties are counts and slugs only: never free text or identities. */
export function track(
  event: AnalyticsEvent,
  properties?: Record<string, string | number | boolean>,
): void {
  withClient((ph) => {
    try {
      ph.capture(event, properties)
    } catch {
      // Analytics never breaks the app.
    }
  })
}

/** Handled errors worth knowing about (unhandled ones are captured automatically). */
export function reportError(error: unknown, context?: Record<string, string>): void {
  withClient((ph) => {
    try {
      ph.captureException(error, context)
    } catch {
      // ignore
    }
  })
}
