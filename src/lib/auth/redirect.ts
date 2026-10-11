const PROBE_ORIGIN = "http://subcult.invalid"
/** Control characters (tab/CR/LF get stripped by URL parsers) and backslashes. */
const UNSAFE = /[\u0000-\u001f\u007f\\]/

/**
 * Only same-site paths survive a login round trip. Rather than pattern-match
 * ("//evil.com", "/\evil.com", "/%09/evil.com"…), parse the value the way the
 * redirect will and keep it only if it stays on our origin.
 */
export function safeNext(value: string | null | undefined, fallback = "/me"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || UNSAFE.test(value)) {
    return fallback
  }
  try {
    const url = new URL(value, PROBE_ORIGIN)
    return url.origin === PROBE_ORIGIN ? `${url.pathname}${url.search}${url.hash}` : fallback
  } catch {
    return fallback
  }
}
