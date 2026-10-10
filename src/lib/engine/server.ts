import "server-only"
import Anthropic from "@anthropic-ai/sdk"
import { getDb } from "@/db"
import { createNicheRepository } from "@/db/niche-repository"
import { createUsageLog } from "@/db/usage-repository"
import { env } from "@/lib/env"
import { errorMessage, log } from "@/lib/log"
import { getNicheGenerationLimiter } from "@/lib/rate-limit"
import { anthropicLlmClient, generateNicheProfile } from "./generate"
import {
  type GenerationPermit,
  type NicheGenerator,
  type NicheService,
  createNicheService,
} from "./niche-service"
import { DAILY_CAPPED_PURPOSES, type UsageLog, startOfUtcDay } from "./usage"

/** Request-path budget: fail fast instead of holding a serverless function open. */
const LLM_TIMEOUT_MS = 60_000
const LLM_MAX_RETRIES = 2

let service: NicheService | null | undefined

export function getUsageLog(): UsageLog | null {
  const db = getDb()
  return db ? createUsageLog(db) : null
}

/** Wires the engine to Postgres + Claude. null when there's no database. */
export function getNicheService(): NicheService | null {
  if (service !== undefined) return service

  const db = getDb()
  if (!db) {
    service = null
    return service
  }

  let generate: NicheGenerator | null = null
  if (env.ANTHROPIC_API_KEY) {
    const llm = anthropicLlmClient(
      new Anthropic({
        apiKey: env.ANTHROPIC_API_KEY,
        timeout: LLM_TIMEOUT_MS,
        maxRetries: LLM_MAX_RETRIES,
      }),
    )
    generate = (niche) => generateNicheProfile(niche, { llm })
  }

  service = createNicheService({
    repo: createNicheRepository(db),
    generate,
    logger: log,
    usage: createUsageLog(db),
  })
  return service
}

/**
 * Two layers of spend protection, cheapest first: the global daily cap
 * (LLM_DAILY_GENERATION_CAP, counted from llm_usage across niche generations
 * and vibe-check blurbs) and then the per-identifier
 * sliding window. Fails closed if the ledger can't be read.
 */
export async function checkGenerationBudget(identifier: string): Promise<GenerationPermit> {
  const usage = getUsageLog()
  if (!usage) return "capped"
  try {
    const since = startOfUtcDay()
    const counts = await Promise.all(
      DAILY_CAPPED_PURPOSES.map((purpose) => usage.countSince(purpose, since)),
    )
    const usedToday = counts.reduce((sum, count) => sum + count, 0)
    if (usedToday >= env.LLM_DAILY_GENERATION_CAP) return "capped"
  } catch (error) {
    log.error("budget.check.error", { error: errorMessage(error) })
    return "capped"
  }
  const { success } = await getNicheGenerationLimiter().limit(identifier)
  return success ? "ok" : "rate-limited"
}
