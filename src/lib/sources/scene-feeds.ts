import { type NewsArticle, hostOf } from "./google-news"
import { parseRss } from "./rss"

/**
 * Scene outlets' own RSS feeds, each checked live (200 + items, Oct 2026).
 * They carry images and ledes Google News doesn't. Items still go through
 * the entity match and relevance pipeline: an outlet being here is not a
 * pass on its own.
 */
export const SCENE_FEEDS: readonly { outlet: string; url: string }[] = [
  { outlet: "Hypebeast", url: "https://hypebeast.com/feed" },
  { outlet: "Highsnobiety", url: "https://www.highsnobiety.com/feed/" },
  { outlet: "Pitchfork", url: "https://pitchfork.com/feed/feed-news/rss" },
  { outlet: "The FADER", url: "https://www.thefader.com/feed" },
  { outlet: "XXL", url: "https://www.xxlmag.com/feed/" },
  { outlet: "Stereogum", url: "https://www.stereogum.com/feed/" },
  { outlet: "NME", url: "https://www.nme.com/feed" },
]

const USER_AGENT = "subcult/1.0 (niche discovery app)"

export async function fetchSceneFeed(
  feed: { outlet: string; url: string },
  { timeoutMs = 6_000, fetchImpl = fetch }: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<NewsArticle[]> {
  const response = await fetchImpl(feed.url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml" },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`${feed.outlet} feed ${response.status}`)
  return parseRss(await response.text()).map((item) => ({
    title: item.title,
    url: item.link,
    outlet: feed.outlet,
    domain: hostOf(item.link),
    publishedAt: item.publishedAt,
    imageUrl: item.imageUrl,
    summary: item.summary,
  }))
}

const SHARED_TTL_MS = 30 * 60 * 1000
let shared: { at: number; articles: Promise<NewsArticle[]> } | null = null

/** Every scene feed, fetched once per instance per 30 minutes and shared by all niches. */
export function allSceneArticles(
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<NewsArticle[]> {
  if (shared && now - shared.at < SHARED_TTL_MS) return shared.articles
  const articles = Promise.allSettled(
    SCENE_FEEDS.map((feed) => fetchSceneFeed(feed, { fetchImpl })),
  ).then((results) => results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])))
  shared = { at: now, articles }
  return articles
}

/** Test hook. */
export function resetSceneFeedCache(): void {
  shared = null
}
