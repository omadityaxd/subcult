/**
 * Whether this browser holds a Supabase session cookie (sb-<ref>-auth-token,
 * possibly chunked as .0/.1). Not proof of a valid session, only a hint: it
 * lets guest pages skip calls that can only answer 401.
 */
const SESSION_COOKIE = /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/

export function hasSessionCookie(cookies: string): boolean {
  return SESSION_COOKIE.test(cookies)
}

/** In the browser: the current document's cookies. */
export function maybeSignedIn(): boolean {
  return typeof document !== "undefined" && hasSessionCookie(document.cookie)
}
