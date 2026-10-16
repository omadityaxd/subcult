import type { NicheProfile } from "@/lib/engine/profile-schema"
import { TAXONOMY } from "@/lib/niches/catalog"
import { type NewsArticle, fetchGoogleNews } from "@/lib/sources/google-news"
import { allSceneArticles } from "@/lib/sources/scene-feeds"
import { containsTerm, isAmbiguous } from "../relevance"
import type { FeedItem, Fetcher } from "../types"

/** Fresh tea only: Google News `when:7d`, and scene-feed items from the same week. */
export const LOOKBACK_DAYS = 7
const ARTISTS_QUERIED = 5
const BRANDS_QUERIED = 4
/** Per search (and for the scene feeds), so a broad phrase can't crowd out entity hits. */
const PER_QUERY = 8
const MAX_ITEMS = 32
const DAY_MS = 24 * 60 * 60 * 1000

/** Small stable hash for ids (Google News URLs are long opaque redirects). */
export function hashString(value: string): string {
  let hash = 5381
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0
  return (hash >>> 0).toString(36)
}

/**
 * The niche's named entities: verified taxonomy artists and brands first;
 * generated niches (no taxonomy yet) fall back to their profile's names.
 * Artists count only for scene niches (inside a hub): an aesthetic like
 * cottagecore lists Taylor Swift as its sound, but her headlines aren't its tea.
 */
export function newsEntities(profile: NicheProfile): { artists: string[]; brands: string[] } {
  if (!TAXONOMY.branchOf(profile.slug)) {
    return { artists: [], brands: TAXONOMY.brandsOf(profile.slug).map((brand) => brand.name) }
  }
  const artists = TAXONOMY.artistsOf(profile.slug).map((artist) => artist.name)
  const brands = TAXONOMY.brandsOf(profile.slug).map((brand) => brand.name)
  return {
    artists: artists.length > 0 ? artists : profile.artists.map((artist) => artist.name),
    brands: brands.length > 0 ? brands : profile.brands.map((brand) => brand.name),
  }
}

const quoted = (names: readonly string[]) =>
  names.map((name) => `"${name.replace(/"/g, "")}"`).join(" OR ")

/**
 * Entity-driven searches: who's in the scene and what they wear (anchored to
 * fashion, so "Balenciaga" isn't a shipyard), then the niche's own phrases.
 * Ambiguous one-word artist names ("Che") are dropped from the search.
 */
export function newsQueriesFor(profile: NicheProfile): string[] {
  const { artists, brands } = newsEntities(profile)
  const artistTerms = artists.filter((name) => !isAmbiguous(name)).slice(0, ARTISTS_QUERIED)
  const phrases = profile.newsQueries.slice(0, artistTerms.length > 0 ? 1 : 2)
  return [
    artistTerms.length > 0 ? quoted(artistTerms) : null,
    brands.length > 0 ? `(${quoted(brands.slice(0, BRANDS_QUERIED))}) fashion` : null,
    ...phrases,
  ].filter((query): query is string => query !== null)
}

/** Words that put a headline in fashion, not just near a famous name. */
const FASHION_CONTEXT = [
  "fashion",
  "fashion week",
  "runway",
  "collection",
  "capsule",
  "lookbook",
  "campaign",
  "wears",
  "wearing",
  "wore",
  "outfit",
  "outfits",
  "style",
  "designer",
  "archive",
  "sneaker",
  "sneakers",
  "jacket",
  "jackets",
  "denim",
  "merch",
  "menswear",
  "womenswear",
  "apparel",
  "clothing",
  "footwear",
  "boots",
  "grails",
  "resale",
  "colorway",
  "colorways",
  "restock",
  "silhouette",
  "hoodie",
  "hoodies",
  "tee",
  "sneaker release",
]
/** Season codes: "SS27", "FW26", "AW25". */
const SEASON_CODE = /\b(ss|fw|aw)\d{2}\b/i

const FASHION_BRANCH = "underground-fashion"

/**
 * Does the headline name the niche's world on its own terms? Scene artists
 * count for music niches; in fashion niches an artist needs a fashion word
 * ("A$AP Rocky drops a single" isn't archive-fashion tea). One-word brand
 * names need one too ("undercover investigation"). Headlines naming no
 * entity at all are left to the relevance pipeline.
 */
export function onTopic(title: string, profile: NicheProfile): boolean {
  const { artists, brands } = newsEntities(profile)
  const named = (names: readonly string[]) => names.some((name) => containsTerm(title, name))
  const fashionWord =
    SEASON_CODE.test(title) || FASHION_CONTEXT.some((word) => containsTerm(title, word))
  const artistHit = named(artists.filter((name) => !isAmbiguous(name)))
  const brandHit = named(brands.filter((name) => name.includes(" ")))
  const wordBrandHit = named(brands.filter((name) => !name.includes(" ")))
  if (!artistHit && !brandHit && !wordBrandHit) return true
  if (containsTerm(title, profile.name)) return true
  const fashionNiche = TAXONOMY.branchOf(profile.slug) === FASHION_BRANCH
  if (artistHit && (!fashionNiche || fashionWord)) return true
  return brandHit || (wordBrandHit && fashionWord)
}

/** Scene-feed articles that name one of the niche's entities, from the last week. */
export function sceneMatches(
  articles: readonly NewsArticle[],
  profile: NicheProfile,
  now: number,
): NewsArticle[] {
  const { artists, brands } = newsEntities(profile)
  const names = [...artists, ...brands].filter((name) => !isAmbiguous(name))
  return articles.filter(
    (article) =>
      article.publishedAt !== null &&
      now - article.publishedAt.getTime() <= LOOKBACK_DAYS * DAY_MS &&
      names.some((name) => containsTerm(article.title, name)),
  )
}

function toItem(article: NewsArticle, profile: NicheProfile): FeedItem {
  return {
    id: `news:article:${hashString(article.url)}`,
    source: "news",
    type: "article",
    title: article.title,
    subtitle: article.outlet,
    imageUrl: article.imageUrl,
    url: article.url,
    publishedAt: article.publishedAt?.toISOString() ?? null,
    score: 0,
    meta: {
      outlet: article.outlet,
      domain: article.domain,
      summary: article.summary,
      nicheSlug: profile.slug,
      nicheName: profile.name,
    },
  }
}

/** Google News RSS (keyless) plus the scene outlets' own feeds, newest first. */
export function newsFetcher(
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): Fetcher {
  return {
    source: "news",
    freshSeconds: 3600,
    staleSeconds: 24 * 3600,
    // e1: entity queries, 7-day window, scene feeds, images and summaries.
    cacheVersion: "e2",
    async fetch(profile: NicheProfile) {
      const [scene, ...settled] = await Promise.allSettled([
        allSceneArticles(fetchImpl),
        ...newsQueriesFor(profile).map((query) =>
          fetchGoogleNews(query, { days: LOOKBACK_DAYS, fetchImpl }),
        ),
      ])
      const share = (articles: readonly NewsArticle[]) =>
        articles.filter((article) => onTopic(article.title, profile)).slice(0, PER_QUERY)
      const searched = settled.flatMap((r) => (r.status === "fulfilled" ? share(r.value) : []))
      const fromScene =
        scene.status === "fulfilled" ? share(sceneMatches(scene.value, profile, now())) : []
      if (searched.length === 0 && fromScene.length === 0) {
        const failure = settled.find((r) => r.status === "rejected")
        if (failure?.status === "rejected" && scene.status === "rejected") throw failure.reason
      }
      const seen = new Set<string>()
      // Scene feeds first: same story, but with the publisher's image and lede.
      return [...fromScene, ...searched]
        .filter((article) => !seen.has(article.title) && seen.add(article.title))
        .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
        .slice(0, MAX_ITEMS)
        .map((article) => toItem(article, profile))
    },
  }
}
