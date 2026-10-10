import "server-only"
import Anthropic from "@anthropic-ai/sdk"
import { getDb } from "@/db"
import { createNicheRepository } from "@/db/niche-repository"
import { env } from "@/lib/env"
import { log } from "@/lib/log"
import { anthropicLlmClient, generateNicheProfile } from "./generate"
import { type NicheGenerator, type NicheService, createNicheService } from "./niche-service"

/** Request-path budget: fail fast instead of holding a serverless function open. */
const LLM_TIMEOUT_MS = 60_000
const LLM_MAX_RETRIES = 2

let service: NicheService | null | undefined

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

  service = createNicheService({ repo: createNicheRepository(db), generate, logger: log })
  return service
}
