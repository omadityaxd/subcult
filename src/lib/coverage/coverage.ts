/**
 * Content supply per niche: is every pipeline fed, not just music? Pure
 * thresholds + formatting; scripts/content-coverage.ts gathers the counts.
 */

export const COVERAGE_KINDS = ["fits", "grails", "tea", "tracks", "pins", "videos"] as const
export type CoverageKind = (typeof COVERAGE_KINDS)[number]

export type CoverageCounts = Record<CoverageKind, number>

export interface NicheCoverage {
  slug: string
  featured: boolean
  /** Fashion niches need grails; music niches don't. */
  fashion: boolean
  counts: CoverageCounts
}

/** Minimums before launch. Grails apply to fashion niches only. */
export const THRESHOLDS: CoverageCounts = {
  fits: 4,
  grails: 8,
  tea: 3,
  tracks: 5,
  pins: 6,
  videos: 2,
}

export function shortfalls(niche: NicheCoverage): CoverageKind[] {
  return COVERAGE_KINDS.filter((kind) => {
    if (kind === "grails" && !niche.fashion) return false
    return niche.counts[kind] < THRESHOLDS[kind]
  })
}

export function formatCoverage(niches: readonly NicheCoverage[]): string {
  const header = `${"niche".padEnd(30)} ${COVERAGE_KINDS.map((k) => k.padStart(7)).join("")}  status`
  const rows = niches.map((niche) => {
    const missing = shortfalls(niche)
    const cells = COVERAGE_KINDS.map((kind) => {
      const value = kind === "grails" && !niche.fashion ? "-" : String(niche.counts[kind])
      return value.padStart(7)
    }).join("")
    const status = missing.length === 0 ? "ok" : `LOW: ${missing.join(", ")}`
    return `${(niche.featured ? "* " : "  ") + niche.slug.padEnd(28)} ${cells}  ${status}`
  })
  const featured = niches.filter((n) => n.featured)
  const passing = featured.filter((n) => shortfalls(n).length === 0).length
  return [
    header,
    ...rows,
    "",
    `featured niches passing: ${passing}/${featured.length}  (* = featured; thresholds ${JSON.stringify(THRESHOLDS)})`,
  ].join("\n")
}
