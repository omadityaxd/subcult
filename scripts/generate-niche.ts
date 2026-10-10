/**
 * pnpm generate:niche "<name>"
 *
 * Generates one user-style niche with Claude through the same cache-first
 * engine the app uses (no-op if it already exists). Needs ANTHROPIC_API_KEY.
 * 429/529 responses are retried by the Anthropic SDK with exponential backoff.
 */
import Anthropic from "@anthropic-ai/sdk"
import { createDb } from "../src/db/create-db"
import { createNicheRepository } from "../src/db/niche-repository"
import { anthropicLlmClient, generateNicheProfile } from "../src/lib/engine/generate"
import { createNicheService } from "../src/lib/engine/niche-service"
import { log } from "../src/lib/log"
import { loadLocalEnv } from "./load-env"

const SDK_MAX_RETRIES = 6

async function main(): Promise<void> {
  loadLocalEnv()
  const name = process.argv.slice(2).join(" ").trim()
  const apiKey = process.env.ANTHROPIC_API_KEY
  const databaseUrl = process.env.DATABASE_URL
  if (!name) {
    console.error('usage: pnpm generate:niche "jersey club girlies"')
    process.exitCode = 1
    return
  }
  if (!apiKey || !databaseUrl) {
    console.error("Missing ANTHROPIC_API_KEY or DATABASE_URL. Set them in .env.local first.")
    process.exitCode = 1
    return
  }

  const { db, close } = createDb(databaseUrl, { max: 1 })
  try {
    const llm = anthropicLlmClient(new Anthropic({ apiKey, maxRetries: SDK_MAX_RETRIES }))
    const service = createNicheService({
      repo: createNicheRepository(db),
      generate: (niche) => generateNicheProfile(niche, { llm }),
      logger: log,
    })
    const result = await service.getOrCreate(name, { generatedBy: "user" })

    if (result.status === "found") {
      const { profile } = result.niche
      console.log(`\n${profile.emoji} ${profile.name} (${result.source}) → /n/${profile.slug}`)
      console.log(profile.tagline)
    } else {
      console.error(`\n${result.status}: ${result.reason}`)
      process.exitCode = 1
    }
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
