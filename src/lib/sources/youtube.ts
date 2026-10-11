import { z } from "zod"
import { decodeEntities } from "./rss"

export interface YoutubeVideo {
  id: string
  title: string
  url: string
  channel: string
  publishedAt: Date | null
  thumbnailUrl: string | null
}

interface YoutubeSearchOptions {
  apiKey: string
  publishedAfter?: Date
  maxResults?: number
  order?: "date" | "relevance" | "viewCount"
  /** "medium" = 4-20 min: excludes Shorts, which dominate unfiltered results. */
  videoDuration?: "any" | "short" | "medium" | "long"
  /** ISO 3166-1 alpha-2, e.g. "US": results viewable/popular in that region. */
  regionCode?: string
  /** ISO 639-1, e.g. "en": prefer results in that language. */
  relevanceLanguage?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

// Only the fields we use; the API response is external data and gets validated.
const searchResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.object({ videoId: z.string().optional() }),
      snippet: z.object({
        title: z.string(),
        channelTitle: z.string(),
        publishedAt: z.string().optional(),
        thumbnails: z
          .object({
            high: z.object({ url: z.string() }).optional(),
            medium: z.object({ url: z.string() }).optional(),
          })
          .optional(),
      }),
    }),
  ),
})

/** YouTube Data API v3 search.list (100 quota units per call). */
export async function searchYoutube(
  query: string,
  {
    apiKey,
    publishedAfter,
    maxResults = 8,
    order = "date",
    videoDuration = "any",
    regionCode,
    relevanceLanguage,
    timeoutMs = 6_000,
    fetchImpl = fetch,
  }: YoutubeSearchOptions,
): Promise<YoutubeVideo[]> {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    q: query,
    order,
    maxResults: String(maxResults),
    key: apiKey,
  })
  if (publishedAfter) params.set("publishedAfter", publishedAfter.toISOString())
  if (videoDuration !== "any") params.set("videoDuration", videoDuration)
  if (regionCode) params.set("regionCode", regionCode)
  if (relevanceLanguage) params.set("relevanceLanguage", relevanceLanguage)

  const response = await fetchImpl(`https://www.googleapis.com/youtube/v3/search?${params}`, {
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`YouTube ${response.status} for "${query}"`)

  const parsed = searchResponseSchema.safeParse(await response.json())
  if (!parsed.success) throw new Error("Unexpected YouTube response shape")

  return parsed.data.items.flatMap((item): YoutubeVideo[] => {
    const id = item.id.videoId
    if (!id) return []
    const published = item.snippet.publishedAt ? new Date(item.snippet.publishedAt) : null
    return [
      {
        id,
        title: decodeEntities(item.snippet.title),
        url: `https://www.youtube.com/watch?v=${id}`,
        channel: decodeEntities(item.snippet.channelTitle),
        publishedAt: published && !Number.isNaN(published.getTime()) ? published : null,
        thumbnailUrl:
          item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.medium?.url ?? null,
      },
    ]
  })
}
