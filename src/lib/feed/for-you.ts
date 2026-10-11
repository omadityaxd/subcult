import { normalizeTitle } from "@/lib/music/itunes"
import { TAXONOMY, findPreset, nicheArtistsLeadFirst } from "@/lib/niches/catalog"
import type { NicheFeed } from "./feed"
import { type MixKind, type MixShares, mixFeed, resolveMix } from "./mix"
import { encodeRelatedNiches } from "./related-niches"
import type { FeedItem } from "./types"

const ARTIST_CARDS = 6
const DISCOVERY_CARDS = 6

/** Verified artists as in-app cards (tap → artist sheet, not Spotify). */
export function artistCards(slug: string): FeedItem[] {
  return nicheArtistsLeadFirst(slug)
    .slice(0, ARTIST_CARDS)
    .map((artist) => ({
      id: `subcult:artist:${artist.slug}`,
      source: "subcult",
      type: "artist",
      title: artist.name,
      subtitle: null,
      imageUrl: artist.imageUrl,
      url: `/n/${slug}`,
      publishedAt: null,
      score: 1,
      meta: { artistSlug: artist.slug },
    }))
}

/** Neighbouring niches, two-hop picks and a quick action, as in-app cards. */
export function discoveryCards(slug: string): FeedItem[] {
  const neighbours = TAXONOMY.adjacent(slug).map(({ slug: target, label }) => ({ target, label }))
  const hops = TAXONOMY.recommend(slug).map((target) => ({ target, label: "Two hops away" }))
  const niches = [...neighbours, ...hops].flatMap(({ target, label }): FeedItem[] => {
    const preset = findPreset(target)
    return preset
      ? [
          {
            id: `subcult:niche:${target}`,
            source: "subcult",
            type: "niche",
            title: preset.name,
            subtitle: preset.tagline,
            imageUrl: preset.imageUrl,
            url: `/n/${target}`,
            publishedAt: null,
            score: 1,
            meta: { label, slug: target },
          },
        ]
      : []
  })
  const vibeCheck: FeedItem = {
    id: "subcult:prompt:vibe-check",
    source: "subcult",
    type: "prompt",
    title: "What's your niche, actually?",
    subtitle: "12 swipes. One brutally accurate mix.",
    imageUrl: null,
    url: "/vibe-check",
    publishedAt: null,
    score: 1,
    meta: { action: "Take the vibe check" },
  }
  // The prompt sits after the first couple of niche cards, not first.
  return [...niches.slice(0, 2), vibeCheck, ...niches.slice(2)].slice(0, DISCOVERY_CARDS)
}

/** Spotify artist results that are verified artists open our artist sheet, not Spotify. */
export function withArtistSlugs(items: readonly FeedItem[]): FeedItem[] {
  return items.map((item) => {
    if (item.source !== "spotify" || item.type !== "artist") return item
    const slug = TAXONOMY.resolve(item.title, "artist")
    return slug ? { ...item, meta: { ...item.meta, artistSlug: slug } } : item
  })
}

const VIDEO_NICHES = 4

/** Videos carry the niche and its neighbours, for the viewer's "related niches" chips. */
export function withVideoNiches(items: readonly FeedItem[], slug: string): FeedItem[] {
  const niches = [slug, ...TAXONOMY.adjacent(slug).map((adjacent) => adjacent.slug)]
    .flatMap((target) => {
      const preset = findPreset(target)
      return preset ? [{ slug: target, name: preset.name }] : []
    })
    .filter((niche, i, all) => all.findIndex((other) => other.slug === niche.slug) === i)
    .slice(0, VIDEO_NICHES)
  return items.map((item) =>
    item.source === "youtube"
      ? { ...item, meta: { ...item.meta, niches: encodeRelatedNiches(niches) } }
      : item,
  )
}

/** The niche's target shares: default ← its branch ← its own override. */
export function nicheMix(slug: string): MixShares {
  return resolveMix(TAXONOMY.branchOf(slug), TAXONOMY.curation(slug)?.mix)
}

/**
 * A niche's For You stream: every content kind, interleaved to hit the
 * niche's shares. Extra buckets (moodboard pins, shop listings) slot in
 * as those sources come online.
 */
export function buildForYou(
  slug: string,
  feed: Pick<NicheFeed, "bySource">,
  extra: Partial<Record<MixKind, readonly FeedItem[]>> = {},
  limit = 40,
): FeedItem[] {
  const spotifyItems = withArtistSlugs(feed.bySource.spotify ?? [])
  const seen = new Set(spotifyItems.map((item) => normalizeTitle(item.title)))
  const soundtrack = (extra.music ?? []).filter((item) => !seen.has(normalizeTitle(item.title)))
  return mixFeed(
    {
      ...extra,
      // Spotify results first (fresh), then the niche's soundtrack (always playable in-app).
      music: [...spotifyItems, ...soundtrack],
      video: withVideoNiches(feed.bySource.youtube ?? [], slug),
      news: feed.bySource.news ?? [],
      artists: artistCards(slug),
      discovery: discoveryCards(slug),
    },
    nicheMix(slug),
    limit,
  )
}
