import type { NicheProfile } from "@/lib/engine/profile-schema"

/** Live sources. Reddit is deliberately absent: its API closed (see ARCHITECTURE.md). */
export const FEED_SOURCES = [
  "spotify",
  "youtube",
  "news",
  /** Moodboard pins */
  "arena",
  "unsplash",
  "pexels",
  /** Shop listings */
  "ebay",
  /** Our own cards: artists (open the in-app sheet), niches, quick actions */
  "subcult",
] as const
export type FeedSource = (typeof FEED_SOURCES)[number]

export type FeedItemType =
  "track" | "artist" | "playlist" | "video" | "article" | "pin" | "product" | "niche" | "prompt"

/** Every source normalizes into this one shape so ranking can mix them. */
export interface FeedItem {
  /** Stable across fetches: `${source}:${type}:${nativeId}`. Feedback keys off it. */
  id: string
  source: FeedSource
  type: FeedItemType
  title: string
  subtitle: string | null
  imageUrl: string | null
  url: string
  /** ISO 8601; strings survive the JSON round-trip through Redis. */
  publishedAt: string | null
  score: number
  /** Source-specific extras, e.g. embedUrl (Spotify), channel (YouTube), outlet (news). */
  meta: Record<string, string | number | boolean | null>
}

export interface Fetcher {
  source: FeedSource
  /** How long results are served without refetching. */
  freshSeconds: number
  /** How long results stay usable as a fallback when the source is failing. */
  staleSeconds: number
  /**
   * Bump to refresh just this source's cache when its output changes (the
   * global CACHE_VERSION would also orphan every other source's stale copy).
   */
  cacheVersion?: string
  fetch(profile: NicheProfile): Promise<FeedItem[]>
}
