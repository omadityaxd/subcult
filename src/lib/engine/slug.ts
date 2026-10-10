export const NICHE_NAME_MIN = 2
export const NICHE_NAME_MAX = 50
const SLUG_MAX = 64

export type NicheInput = { ok: true; name: string; slug: string } | { ok: false; reason: string }

/** Canonical display form: NFKC, single spaces, lowercase. */
export function normalizeNicheName(raw: string): string {
  return raw.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase()
}

/**
 * Stable cache key: "Jersey Club Girlies!!" and "jersey-club girlies" map to
 * the same slug, so the same niche is never generated twice.
 */
export function toNicheSlug(raw: string): string {
  return normalizeNicheName(raw)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "")
}

/** Validates user-typed niche names before anything touches the DB or LLM. */
export function parseNicheInput(raw: unknown): NicheInput {
  if (typeof raw !== "string") return { ok: false, reason: "type a vibe first 👀" }
  const name = normalizeNicheName(raw)
  if (name.length < NICHE_NAME_MIN) return { ok: false, reason: "a little more than that, bestie" }
  if (name.length > NICHE_NAME_MAX) return { ok: false, reason: "that's a whole essay. shorter?" }
  if (!/\p{L}/u.test(name)) return { ok: false, reason: "niches need at least one letter" }
  const slug = toNicheSlug(name)
  if (!slug) return { ok: false, reason: "we couldn't make sense of that one" }
  return { ok: true, name, slug }
}
