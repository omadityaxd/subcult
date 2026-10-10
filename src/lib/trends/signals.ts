import type Anthropic from "@anthropic-ai/sdk"
import type { GenerationStats } from "@/lib/engine/generate"
import { addCost, estimateCostUsd } from "@/lib/engine/pricing"
import { addDays } from "@/lib/niches/lifecycle"
import { fetchGoogleNews } from "@/lib/sources/google-news"
import { searchYoutube } from "@/lib/sources/youtube"
import type { RawSignal, SignalSource, TrendSignal, WebResearcher } from "./types"

/** Broad queries that surface new aesthetics rather than any one niche. */
export const TREND_QUERIES = [
  "new aesthetic trend",
  "core aesthetic trend gen z",
  "viral gen z subculture",
  "tiktok fashion trend",
  "new internet aesthetic",
] as const

const LOOKBACK_DAYS = 30
const MAX_SIGNALS = 60

export function newsSignalSource(queries: readonly string[] = TREND_QUERIES): SignalSource {
  return {
    name: "google-news",
    async gather() {
      const results = await Promise.allSettled(
        queries.map((query) => fetchGoogleNews(query, { days: LOOKBACK_DAYS })),
      )
      return results.flatMap((result) =>
        result.status === "fulfilled"
          ? result.value.map((article): RawSignal => ({
              kind: "news",
              title: article.title,
              url: article.url,
              outlet: article.outlet,
              publishedAt: article.publishedAt,
            }))
          : [],
      )
    },
  }
}

export function youtubeSignalSource(
  apiKey: string,
  queries: readonly string[] = TREND_QUERIES,
  now: Date = new Date(),
): SignalSource {
  return {
    name: "youtube",
    async gather() {
      const publishedAfter = addDays(now, -LOOKBACK_DAYS)
      const results = await Promise.allSettled(
        queries.map((query) => searchYoutube(query, { apiKey, publishedAfter, order: "date" })),
      )
      return results.flatMap((result) =>
        result.status === "fulfilled"
          ? result.value.map((video): RawSignal => ({
              kind: "youtube",
              title: video.title,
              url: video.url,
              outlet: video.channel,
              publishedAt: video.publishedAt,
            }))
          : [],
      )
    },
  }
}

const normalizeTitle = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

/** Dedupe by URL and near-identical title, newest first, capped, with stable ids s1…sN. */
export function mergeSignals(batches: readonly RawSignal[][], max = MAX_SIGNALS): TrendSignal[] {
  const seenUrls = new Set<string>()
  const seenTitles = new Set<string>()
  const unique: RawSignal[] = []
  for (const signal of batches.flat()) {
    const title = normalizeTitle(signal.title)
    if (!title || seenUrls.has(signal.url) || seenTitles.has(title)) continue
    seenUrls.add(signal.url)
    seenTitles.add(title)
    unique.push(signal)
  }
  unique.sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
  return unique.slice(0, max).map((signal, index) => ({ ...signal, id: `s${index + 1}` }))
}

/** $10 per 1,000 searches, on top of tokens (Anthropic pricing, Oct 2026). */
const WEB_SEARCH_USD = 0.01
const WEB_SEARCH_MAX_USES = 5

/**
 * Optional research step: Claude with the web search server tool finds
 * pages about emerging aesthetics; the result URLs become citable signals.
 * Uses the basic tool version with direct calls (no dynamic filtering).
 */
export function claudeWebResearcher(client: Anthropic, model: string): WebResearcher {
  return {
    estimateUsd: WEB_SEARCH_MAX_USES * WEB_SEARCH_USD + 0.03,
    async run() {
      const startedAt = Date.now()
      const response = await client.messages.create({
        model,
        max_tokens: 4_000,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: WEB_SEARCH_MAX_USES,
            allowed_callers: ["direct"],
          },
        ],
        messages: [
          {
            role: "user",
            content:
              "Search the web for aesthetics, style tribes and subcultures that Gen Z started talking about in the last 30 days (new '-core' aesthetics, viral fashion or music scenes). Search a few different angles, then list what you found in one short paragraph.",
          },
        ],
      })

      const signals: RawSignal[] = response.content.flatMap((block) => {
        if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) return []
        return block.content.flatMap((result): RawSignal[] => {
          if (!URL.canParse(result.url)) return []
          return [
            {
              kind: "web",
              title: result.title,
              url: result.url,
              outlet: new URL(result.url).hostname.replace(/^www\./, ""),
              publishedAt: null,
            },
          ]
        })
      })

      const usage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      }
      const searches = response.usage.server_tool_use?.web_search_requests ?? 0
      const stats: GenerationStats = {
        model,
        usage,
        attempts: 1,
        costUsd: addCost(estimateCostUsd(model, usage), searches * WEB_SEARCH_USD),
        durationMs: Date.now() - startedAt,
      }
      return { signals, stats }
    },
  }
}
