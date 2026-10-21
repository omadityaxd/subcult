import type { SearchResults } from "@/app/api/search/route"
import type { NichePreset } from "@/lib/niches/catalog"
import { presetIs, presetMatches } from "@/lib/niches/preset-search"

export type SearchGroup =
  | "Recent"
  | "Trending"
  | "Niches"
  | "Artists"
  | "Brands"
  | "Tracks"
  | "Fits"
  | "Headlines"
  | "Pages"

type Base = { id: string; group: SearchGroup; label: string; hint: string }

export type Entry =
  | (Base & { kind: "niche"; preset: NichePreset })
  | (Base & { kind: "artist"; artist: SearchResults["artists"][number] })
  | (Base & { kind: "brand"; brand: SearchResults["brands"][number] })
  | (Base & { kind: "track"; index: number; track: SearchResults["tracks"][number] })
  | (Base & { kind: "fit"; fit: SearchResults["fits"][number] })
  | (Base & { kind: "headline"; headline: SearchResults["headlines"][number] })
  | (Base & { kind: "page"; href: string; page: "explore" | "vibe" })
  | (Base & { kind: "summon"; query: string })
  | (Base & { kind: "query"; query: string })

const MAX_NICHES = 5

const PAGES: Entry[] = [
  {
    kind: "page",
    id: "p-explore",
    group: "Pages",
    label: "Explore",
    hint: "Every niche",
    href: "/explore",
    page: "explore",
  },
  {
    kind: "page",
    id: "p-vibe",
    group: "Pages",
    label: "Take the vibe check",
    hint: "10 to 16 swipes",
    href: "/vibe-check",
    page: "vibe",
  },
]

const listingsHint = (count: number | null) =>
  count === null ? "Brand" : count === 0 ? "No live listings right now" : `${count} live listings`

/**
 * Everything the palette shows, in order and grouped. An empty query shows
 * recent and trending searches; a query shows niches from the catalog and
 * whatever the server found, then the option to summon a new niche.
 */
export function buildEntries({
  query,
  presets,
  results,
  recent,
  trending,
}: {
  query: string
  presets: readonly NichePreset[]
  results: SearchResults | null
  recent: readonly string[]
  trending: readonly { kind: string; slug: string; label: string }[]
}): Entry[] {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return [
      ...recent.map((text): Entry => ({
        kind: "query",
        id: `r-${text}`,
        group: "Recent",
        label: text,
        hint: "Search again",
        query: text,
      })),
      ...trending.map((t): Entry => ({
        kind: "query",
        id: `t-${t.kind}-${t.slug}`,
        group: "Trending",
        label: t.label,
        hint: `Trending ${t.kind}`,
        query: t.label,
      })),
      ...PAGES,
    ]
  }
  const niches = presets
    .filter((preset) => presetMatches(preset, needle))
    .slice(0, MAX_NICHES)
    .map((preset): Entry => ({
      kind: "niche",
      id: `n-${preset.slug}`,
      group: "Niches",
      label: preset.name,
      hint: preset.tagline,
      preset,
    }))
  const r = results
  const server: Entry[] = r
    ? [
        ...r.artists.map((artist): Entry => ({
          kind: "artist",
          id: `a-${artist.slug}`,
          group: "Artists",
          label: artist.name,
          hint: artist.niche ? `Artist · ${artist.niche}` : "Artist",
          artist,
        })),
        ...r.brands.map((brand): Entry => ({
          kind: "brand",
          id: `b-${brand.slug}`,
          group: "Brands",
          label: brand.name,
          hint: listingsHint(brand.listings),
          brand,
        })),
        ...r.tracks.map((track, index): Entry => ({
          kind: "track",
          id: `t-${track.id}`,
          group: "Tracks",
          label: track.title,
          hint: track.artist,
          index,
          track,
        })),
        ...r.fits.map((fit): Entry => ({
          kind: "fit",
          id: `f-${fit.id}`,
          group: "Fits",
          label: fit.caption ?? `Fit by @${fit.handle}`,
          hint: `@${fit.handle}`,
          fit,
        })),
        ...r.headlines.map((headline): Entry => ({
          kind: "headline",
          id: `h-${headline.url}`,
          group: "Headlines",
          label: headline.title,
          hint: headline.outlet ?? "News",
          headline,
        })),
      ]
    : []
  // Summoning a niche makes sense for a new scene's name, not for an artist or brand we know.
  const namesKnown = (name: string) => name.toLowerCase() === needle
  const known =
    presets.some((preset) => presetIs(preset, needle)) ||
    (r?.artists ?? []).some((a) => namesKnown(a.name)) ||
    (r?.brands ?? []).some((b) => namesKnown(b.name))
  const summon: Entry[] =
    needle.length >= 2 && !known
      ? [
          {
            kind: "summon",
            id: "summon",
            group: "Niches",
            label: `Summon “${query.trim()}”`,
            hint: "Generate a new niche",
            query: query.trim(),
          },
        ]
      : []
  const pages = PAGES.filter((page) => page.label.toLowerCase().includes(needle))
  return [...niches, ...server, ...summon, ...pages]
}
