import { PREVIOUS_VISIT_COOKIE, TASTE_COOKIE } from "@/lib/today/cookies"
import { ISSUE_COOKIE } from "@/lib/today/issues"

/**
 * What signing out leaves on the device: settings of the device itself, not
 * of the person who used it. Everything else under "subcult-" (taste, saves,
 * votes, vibe result, issues, recent searches, a connected Spotify session…)
 * belongs to the account and goes.
 */
const DEVICE_SETTINGS = new Set([
  "subcult-theme",
  "subcult-audio-muted",
  "subcult-autoplay-soundtrack",
  "subcult-install-dismissed",
])

/** The stored keys to remove on sign-out. */
export function personalStorageKeys(keys: readonly string[]): string[] {
  return keys.filter((key) => key.startsWith("subcult-") && !DEVICE_SETTINGS.has(key))
}

/** Cookies that carry this person's taste and issue count into the server-rendered Today. */
export const PERSONAL_COOKIES = [TASTE_COOKIE, PREVIOUS_VISIT_COOKIE, ISSUE_COOKIE] as const
