import type { Listing } from "./ebay"

/**
 * Archive tab logic. Listings come from live eBay searches per brand; here
 * they're dated (from what sellers write in titles), grouped by brand and
 * era, priced as ranges and flagged as grails. Nothing is inferred beyond
 * the listing text and price.
 */

export interface DatedListing extends Listing {
  brand: string
  /** "FW06", "SS03" when the title names a season, else null. */
  season: string | null
  /** "2000s", "1990s"… or null when the title doesn't date the piece. */
  era: string | null
  grail: boolean
}

export interface EraGroup {
  era: string | null
  listings: DatedListing[]
}

export interface BrandArchive {
  brand: string
  brandSlug: string
  priceRange: { min: number; max: number; currency: string } | null
  eras: EraGroup[]
}

/** Grail: the brand's top price quartile right now, at a real archive price… */
export const GRAIL_MIN_PRICE = 400
/** …or a runway or sample piece, whatever the price. */
const RUNWAY = /\b(runway|sample|show piece|look ?\d{1,2})\b/i

const SEASON = /\b(AW|FW|SS)\s?'?(\d{4}|\d{2})\b/i
const YEAR = /\b(19[6-9]\d|20[0-2]\d)\b/
const DECADE = /\b(?:'?(60|70|80|90)s|(?:20)?00s|y2k)\b/i

const decadeOf = (year: number) => `${Math.floor(year / 10) * 10}s`

function fullYear(digits: string): number {
  if (digits.length === 4) return Number(digits)
  const short = Number(digits)
  return short >= 60 ? 1900 + short : 2000 + short
}

/** Reads a season / era from a listing title, or nulls when it isn't stated. */
export function dateFromTitle(title: string): { season: string | null; era: string | null } {
  const season = title.match(SEASON)
  if (season) {
    const year = fullYear(season[2])
    if (year <= new Date().getFullYear()) {
      const label = `${season[1].toUpperCase() === "AW" ? "AW" : season[1].toUpperCase()}${String(year).slice(2)}`
      return { season: label, era: decadeOf(year) }
    }
  }
  const year = title.match(YEAR)
  if (year) return { season: null, era: decadeOf(Number(year[1])) }
  const decade = title.match(DECADE)
  if (decade) {
    if (decade[1]) return { season: null, era: `19${decade[1]}s` }
    return { season: null, era: "2000s" }
  }
  return { season: null, era: null }
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Infinity
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
}

/** Dates, flags and groups one brand's listings. */
export function brandArchive(
  brand: { name: string; slug: string },
  listings: readonly Listing[],
): BrandArchive {
  const prices = listings.map((listing) => listing.price)
  const topQuartile = percentile(prices, 0.75)
  const dated: DatedListing[] = listings.map((listing) => ({
    ...listing,
    brand: brand.name,
    ...dateFromTitle(listing.title),
    grail:
      RUNWAY.test(listing.title) ||
      (listing.price >= GRAIL_MIN_PRICE && listing.price >= topQuartile),
  }))
  const byEra = new Map<string | null, DatedListing[]>()
  for (const listing of dated) {
    byEra.set(listing.era, [...(byEra.get(listing.era) ?? []), listing])
  }
  // Oldest eras first (that's the archive), undated last; grails lead within an era.
  const eras = [...byEra.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b)))
    .map(([era, items]) => ({
      era,
      listings: [...items].sort((x, y) => Number(y.grail) - Number(x.grail) || y.price - x.price),
    }))
  return {
    brand: brand.name,
    brandSlug: brand.slug,
    priceRange:
      prices.length > 0
        ? { min: Math.min(...prices), max: Math.max(...prices), currency: listings[0].currency }
        : null,
    eras,
  }
}

export function formatPrice(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value)
}
