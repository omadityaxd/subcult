import { parseRss } from "./rss"

export interface NewsArticle {
  title: string
  url: string
  outlet: string | null
  /** Publisher hostname without www. ("complex.com"), when the feed names it. */
  domain: string | null
  publishedAt: Date | null
  imageUrl: string | null
  summary: string | null
}

interface GoogleNewsOptions {
  /** Only articles from the last N days (Google News `when:` operator). */
  days?: number
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

const USER_AGENT = "subcult/1.0 (niche discovery app)"

export function googleNewsRssUrl(query: string, days: number): string {
  const q = encodeURIComponent(`${query} when:${days}d`)
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`
}

/** Google News titles end in " - Outlet"; the outlet is shown separately. */
export function stripOutlet(title: string, outlet: string | null): string {
  if (!outlet) return title
  const suffix = ` - ${outlet}`
  return title.endsWith(suffix) ? title.slice(0, -suffix.length) : title
}

export function hostOf(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return null
  }
}

/** Google News RSS search: public, keyless, parsed server-side. */
export async function fetchGoogleNews(
  query: string,
  { days = 30, timeoutMs = 6_000, fetchImpl = fetch }: GoogleNewsOptions = {},
): Promise<NewsArticle[]> {
  const response = await fetchImpl(googleNewsRssUrl(query, days), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml" },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`Google News ${response.status} for "${query}"`)
  return parseRss(await response.text()).map((item) => ({
    title: stripOutlet(item.title, item.source),
    url: item.link,
    outlet: item.source,
    domain: hostOf(item.sourceUrl),
    publishedAt: item.publishedAt,
    imageUrl: item.imageUrl,
    summary: item.summary,
  }))
}
