/**
 * Outbound deep links. subcult aggregates by link: every section can fall back
 * to these even when no API key is configured. Pure functions, safe on client.
 */

const q = (text: string) => encodeURIComponent(text.trim())

export const spotify = {
  search: (query: string) => `https://open.spotify.com/search/${q(query)}`,
  artistSearch: (name: string) => `https://open.spotify.com/search/${q(name)}/artists`,
  playlistSearch: (query: string) => `https://open.spotify.com/search/${q(query)}/playlists`,
}

export const youtube = {
  search: (query: string) => `https://www.youtube.com/results?search_query=${q(query)}`,
}

export const googleNews = {
  search: (query: string) => `https://news.google.com/search?q=${q(query)}`,
}

export const reddit = {
  topThisWeek: (subreddit: string) => `https://www.reddit.com/r/${subreddit}/top/?t=week`,
  searchWithin: (subreddit: string, query: string) =>
    `https://www.reddit.com/r/${subreddit}/search/?q=${q(query)}&restrict_sr=1&sort=top&t=month`,
  home: (subreddit: string) => `https://www.reddit.com/r/${subreddit}/`,
}

export const social = {
  pinterest: (query: string) => `https://www.pinterest.com/search/pins/?q=${q(query)}`,
  instagramTag: (tag: string) =>
    `https://www.instagram.com/explore/tags/${encodeURIComponent(tag.replace(/^#/, ""))}/`,
  tiktok: (query: string) => `https://www.tiktok.com/search?q=${q(query)}`,
}

export interface ShopConfig {
  /** e.g. "amazon.com" (default) or "amazon.in". */
  amazonDomain: string
  amazonTag?: string
}

export const DEFAULT_SHOP_CONFIG: ShopConfig = { amazonDomain: "amazon.com" }

export const STORE_IDS = ["amazon", "depop", "etsy", "asos", "grailed", "google"] as const
export type StoreId = (typeof STORE_IDS)[number]

export interface StoreLink {
  id: StoreId
  label: string
  /** One-line reason to pick this store, shown in the shop sheet. */
  blurb: string
  url: string
}

export function storeLinks(query: string, config: ShopConfig = DEFAULT_SHOP_CONFIG): StoreLink[] {
  const amazonTag = config.amazonTag ? `&tag=${encodeURIComponent(config.amazonTag)}` : ""
  return [
    {
      id: "amazon",
      label: "Amazon",
      blurb: "fast shipping, endless basics",
      url: `https://www.${config.amazonDomain}/s?k=${q(query)}${amazonTag}`,
    },
    {
      id: "depop",
      label: "Depop",
      blurb: "secondhand gems from real closets",
      url: `https://www.depop.com/search/?q=${q(query)}`,
    },
    {
      id: "etsy",
      label: "Etsy",
      blurb: "handmade and vintage finds",
      url: `https://www.etsy.com/search?q=${q(query)}`,
    },
    {
      id: "asos",
      label: "ASOS",
      blurb: "trend-led pieces, every size",
      url: `https://www.asos.com/search/?q=${q(query)}`,
    },
    {
      id: "grailed",
      label: "Grailed",
      blurb: "designer and streetwear resale",
      url: `https://www.grailed.com/shop?query=${q(query)}`,
    },
    {
      id: "google",
      label: "Google Shopping",
      blurb: "compare prices everywhere",
      url: `https://www.google.com/search?tbm=shop&q=${q(query)}`,
    },
  ]
}
