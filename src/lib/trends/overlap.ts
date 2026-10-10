import { toNicheSlug } from "@/lib/engine/slug"
import type { ExistingNiche } from "./types"

/**
 * Suffixes that name-mint new aesthetics without changing the scene:
 * "gorpcore" ≈ "gorp", "coastal cowgirl" ≈ "coastal cowboy".
 */
const VARIANT_SUFFIXES = [
  "core",
  "girlies",
  "girls",
  "girl",
  "boys",
  "boy",
  "kids",
  "aesthetic",
  "wave",
  "era",
  "summer",
]

const MIN_STEM = 3
const OVERLAP_THRESHOLD = 0.5

function stemToken(token: string): string {
  for (const suffix of VARIANT_SUFFIXES) {
    if (token.endsWith(suffix) && token.length - suffix.length >= MIN_STEM) {
      return token.slice(0, -suffix.length)
    }
  }
  return token
}

/** Slug → set of stemmed tokens, dropping pure-suffix tokens ("cowboy core" → {cow}). */
export function stemTokens(slugOrName: string): Set<string> {
  const tokens = toNicheSlug(slugOrName)
    .split("-")
    .filter((token) => token && !VARIANT_SUFFIXES.includes(token))
    .map(stemToken)
  return new Set(tokens)
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const token of a) if (b.has(token)) shared++
  return shared / (a.size + b.size - shared)
}

/**
 * Why a proposed niche duplicates something we already have, or null if it's
 * genuinely new. Checks slugs, stemmed names, and existing relatedNiches
 * (a scene we already point to isn't an emerging trend).
 */
export function findOverlap(
  candidate: { slug: string; name: string },
  existing: readonly ExistingNiche[],
): string | null {
  const candidateTokens = stemTokens(candidate.name)

  for (const niche of existing) {
    if (niche.slug === candidate.slug) return `already exists as ${niche.slug}`
    if (jaccard(candidateTokens, stemTokens(niche.slug)) >= OVERLAP_THRESHOLD) {
      return `overlaps existing niche ${niche.slug}`
    }
  }
  for (const niche of existing) {
    for (const related of niche.relatedNiches) {
      if (jaccard(candidateTokens, stemTokens(related)) >= OVERLAP_THRESHOLD) {
        return `already covered as "${related}" (related to ${niche.slug})`
      }
    }
  }
  return null
}
