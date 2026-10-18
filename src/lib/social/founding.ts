/**
 * The founding 50: the first fifty people who join through a friend's invite
 * link get a numbered badge. Pure rules here; the database enforces
 * uniqueness of each number.
 */
export const FOUNDING_SPOTS = 50
export const INVITE_COOKIE = "sc_invite"
export const INVITE_MAX_AGE_S = 30 * 24 * 3600

/** The next founding number, or null once all spots are taken. */
export function nextFoundingNo(taken: readonly number[]): number | null {
  const max = taken.reduce((m, n) => Math.max(m, n), 0)
  return max < FOUNDING_SPOTS ? max + 1 : null
}

/** Reads the inviter's handle from a Cookie header ("sc_invite=handle"). */
export function inviterFromCookie(header: string | null): string | null {
  if (!header) return null
  for (const part of header.split(";")) {
    const [name, value] = part.trim().split("=")
    if (name === INVITE_COOKIE && value && /^[a-z0-9._]{3,24}$/.test(value)) return value
  }
  return null
}
