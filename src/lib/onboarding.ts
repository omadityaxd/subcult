/** The first-run path (handle, vibe check, niches): prompts wait until it's done. */
export function isOnboarding(pathname: string | null): boolean {
  return ONBOARDING.test(pathname ?? "")
}

// Exact pages only: a shared vibe result (/vibe-check/r/…) isn't onboarding.
const ONBOARDING = new RegExp("^/(start|welcome|vibe-check)/?$")
