import { type EntityRef, isEntityRef } from "@/lib/taste/entities"

/**
 * Today is rendered on the server from three small first-party cookies the
 * client keeps in sync: the strongest taste entities, the previous visit's
 * start, and the time zone. No tracking: they only ever go to our origin,
 * and the full signal log stays on the device (or the account).
 */
export const TASTE_COOKIE = "sc_taste"
export const PREVIOUS_VISIT_COOKIE = "sc_prev"
export const TIME_ZONE_COOKIE = "sc_tz"

const MAX_ENTITIES = 40
/** Well under the ~4KB per-cookie limit. */
const MAX_LENGTH = 3000
const MAX_AGE_S = 90 * 24 * 3600

export interface CookieEntity {
  ref: EntityRef
  score: number
}

/** "artist:nettspend~3.8|niche:jerk~6.9": strongest first, scores to 2 decimals. */
export function encodeTasteCookie(entities: readonly CookieEntity[]): string {
  const parts: string[] = []
  let length = 0
  for (const { ref, score } of [...entities]
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, MAX_ENTITIES)) {
    const part = `${ref}~${Math.round(score * 100) / 100}`
    if (length + part.length + 1 > MAX_LENGTH) break
    parts.push(part)
    length += part.length + 1
  }
  return parts.join("|")
}

/** Untrusted input: anything malformed is dropped, never thrown. */
export function parseTasteCookie(raw: string | undefined): CookieEntity[] {
  if (!raw || raw.length > MAX_LENGTH) return []
  return raw
    .split("|")
    .slice(0, MAX_ENTITIES)
    .flatMap((part) => {
      const [ref, scoreText] = part.split("~")
      const score = Number(scoreText)
      return ref && isEntityRef(ref) && Number.isFinite(score) && Math.abs(score) <= 1000
        ? [{ ref, score }]
        : []
    })
}

export function parsePreviousVisit(raw: string | undefined, now = Date.now()): number | null {
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 && value <= now ? value : null
}

export function cookieAttributes(): string {
  return `Path=/; Max-Age=${MAX_AGE_S}; SameSite=Lax${
    typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : ""
  }`
}

/** Client only. */
export function writeCookie(name: string, value: string): void {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; ${cookieAttributes()}`
  } catch {
    // Cookies blocked: Today falls back to fetching on the client.
  }
}
