import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import type { Database } from "@/db/create-db"
import { createTrendStore } from "@/db/trend-repository"
import { createUsageLog } from "@/db/usage-repository"
import { NICHE_MODEL, anthropicLlmClient } from "@/lib/engine/generate"
import { type Logger, errorMessage } from "@/lib/log"
import { SEED_PROFILES } from "@/lib/niches/catalog"
import type { TrendRefreshDeps } from "./refresh"
import { claudeWebResearcher, newsSignalSource, youtubeSignalSource } from "./signals"
import type { SignalSource } from "./types"

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value

const trendSettingsSchema = z.object({
  ANTHROPIC_API_KEY: z.preprocess(blankToUndefined, z.string().optional()),
  YOUTUBE_API_KEY: z.preprocess(blankToUndefined, z.string().optional()),
  TREND_TTL_DAYS: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).default(42)),
  TREND_RUN_MAX_COST_USD: z.preprocess(
    blankToUndefined,
    z.coerce.number().min(0).max(5).default(0.25),
  ),
  TREND_WEB_SEARCH: z.preprocess(blankToUndefined, z.enum(["true", "false"]).default("false")),
})

export type TrendSettings = z.infer<typeof trendSettingsSchema>

/** Shared by the cron route and `pnpm trends:refresh`, so both read env the same way. */
export function parseTrendSettings(source: Record<string, string | undefined>): TrendSettings {
  return trendSettingsSchema.parse(source)
}

const SDK_TIMEOUT_MS = 90_000
const SDK_MAX_RETRIES = 4

/**
 * Wires the trend pipeline to Postgres, Google News, YouTube and Claude.
 * Web search is opt-in and only enabled when the Models API says the model
 * supports it.
 */
export async function createTrendDeps(
  db: Database,
  settings: TrendSettings,
  logger: Logger,
): Promise<TrendRefreshDeps> {
  const signalSources: SignalSource[] = [newsSignalSource()]
  if (settings.YOUTUBE_API_KEY) signalSources.push(youtubeSignalSource(settings.YOUTUBE_API_KEY))

  let llm: TrendRefreshDeps["llm"] = null
  let webResearch: TrendRefreshDeps["webResearch"] = null
  if (settings.ANTHROPIC_API_KEY) {
    const client = new Anthropic({
      apiKey: settings.ANTHROPIC_API_KEY,
      timeout: SDK_TIMEOUT_MS,
      maxRetries: SDK_MAX_RETRIES,
    })
    llm = anthropicLlmClient(client)
    if (settings.TREND_WEB_SEARCH === "true") {
      webResearch = await webResearcherIfSupported(client, logger)
    }
  }

  return {
    store: createTrendStore(db),
    seeds: SEED_PROFILES.map(({ slug, name, relatedNiches }) => ({ slug, name, relatedNiches })),
    signalSources,
    webResearch,
    llm,
    usage: createUsageLog(db),
    logger,
    config: {
      ttlDays: settings.TREND_TTL_DAYS,
      maxCostUsd: settings.TREND_RUN_MAX_COST_USD,
    },
  }
}

async function webResearcherIfSupported(client: Anthropic, logger: Logger) {
  try {
    const info = await client.models.retrieve(NICHE_MODEL)
    if (info.capabilities?.server_tools.web_search.supported) {
      return claudeWebResearcher(client, NICHE_MODEL)
    }
    logger.warn("trends.web-search.unsupported", { model: NICHE_MODEL })
  } catch (error) {
    logger.warn("trends.web-search.check-failed", { error: errorMessage(error) })
  }
  return null
}
