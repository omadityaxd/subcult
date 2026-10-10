import { withAlpha } from "@/lib/color"

/** FNV-1a: tiny, stable string hash so a slug always yields the same cover. */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** mulberry32: deterministic PRNG from a 32-bit seed. */
function random(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface CoverBackground {
  backgroundColor: string
  backgroundImage: string
}

/**
 * A mesh gradient built from a niche palette: the darkest color as the base,
 * the others as soft radial blobs at seeded positions, plus one faint
 * highlight. Pure CSS (no images, no API), unique per seed, identical on
 * server and client.
 */
export function coverBackground(palette: readonly string[], seed: string): CoverBackground {
  const next = random(hashSeed(seed))
  const [base, ...rest] = palette
  const blobs = rest.map((color) => {
    const x = Math.round(next() * 100)
    const y = Math.round(next() * 100)
    const reach = Math.round(45 + next() * 30)
    return `radial-gradient(at ${x}% ${y}%, ${withAlpha(color, 0.92)} 0px, transparent ${reach}%)`
  })
  const hx = Math.round(15 + next() * 70)
  const highlight = `radial-gradient(at ${hx}% 12%, rgb(255 255 255 / 0.16) 0px, transparent 38%)`
  return {
    backgroundColor: base,
    backgroundImage: [highlight, ...blobs].join(", "),
  }
}
