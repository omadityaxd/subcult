/**
 * Credential checks for /admin (HTTP Basic) and cron routes (Bearer).
 * Pure functions so the proxy, route handlers and server actions share them.
 */

/** Constant-time string comparison: doesn't leak where two secrets diverge. */
export function safeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return diff === 0
}

/** Accepts any username; the password must equal `secret`. Disabled when secret is unset. */
export function isAuthorizedBasic(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header?.startsWith("Basic ")) return false
  let decoded: string
  try {
    decoded = atob(header.slice("Basic ".length).trim())
  } catch {
    return false
  }
  const separator = decoded.indexOf(":")
  if (separator === -1) return false
  return safeEqual(decoded.slice(separator + 1), secret)
}

export function isAuthorizedBearer(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header?.startsWith("Bearer ")) return false
  return safeEqual(header.slice("Bearer ".length).trim(), secret)
}

export const ADMIN_AUTH_CHALLENGE = 'Basic realm="subcult admin", charset="UTF-8"'
