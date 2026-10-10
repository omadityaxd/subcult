/**
 * pnpm seed:niches [--only slug,slug] [--concurrency 3]
 *
 * Pre-generates profiles for the preset catalog so real traffic almost never
 * hits the LLM. Idempotent: niches already in Postgres are skipped.
 * 429/529 responses are retried by the Anthropic SDK with exponential backoff.
 */
import Anthropic from "@anthropic-ai/sdk"
import { createDb } from "../src/db/create-db"
import { createNicheRepository } from "../src/db/niche-repository"
import { mapWithConcurrency } from "../src/lib/concurrency"
import {
  type GenerationResult,
  NICHE_MODEL,
  anthropicLlmClient,
  generateNicheProfile,
} from "../src/lib/engine/generate"
import {
  type TokenUsage,
  ZERO_USAGE,
  addUsage,
  estimateCostUsd,
  formatUsd,
} from "../src/lib/engine/pricing"
import { errorMessage } from "../src/lib/log"
import { NICHE_PRESETS, type NichePreset } from "../src/lib/niches/presets"
import { loadLocalEnv } from "./load-env"

const DEFAULT_CONCURRENCY = 3
const SDK_MAX_RETRIES = 6

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

function describeResult(preset: NichePreset, result: GenerationResult): string {
  const { usage, attempts, costUsd, durationMs } = result.stats
  const tokens = `in ${usage.inputTokens.toLocaleString()} / out ${usage.outputTokens.toLocaleString()} tok`
  const timing = `${attempts} attempt${attempts > 1 ? "s" : ""}  ${(durationMs / 1000).toFixed(1)}s`
  const icon = result.status === "ok" ? "✓" : result.status === "rejected" ? "⊘" : "✗"
  return `${icon} ${preset.slug.padEnd(18)} ${tokens}  ${formatUsd(costUsd)}  ${timing}`
}

async function main(): Promise<void> {
  loadLocalEnv()
  const apiKey = process.env.ANTHROPIC_API_KEY
  const databaseUrl = process.env.DATABASE_URL
  if (!apiKey || !databaseUrl) {
    console.error("Missing ANTHROPIC_API_KEY or DATABASE_URL. Set them in .env.local first.")
    process.exitCode = 1
    return
  }

  const concurrency = Number(readFlag("--concurrency") ?? DEFAULT_CONCURRENCY)
  const only = readFlag("--only")
    ?.split(",")
    .map((slug) => slug.trim())
  const targets = only ? NICHE_PRESETS.filter((p) => only.includes(p.slug)) : NICHE_PRESETS

  const { db, close } = createDb(databaseUrl, { max: concurrency })
  try {
    const repo = createNicheRepository(db)
    const existing = new Set(await repo.listSlugs())
    const todo = targets.filter((preset) => !existing.has(preset.slug))
    const skipped = targets.length - todo.length
    console.log(
      `seeding ${todo.length} niche(s), skipping ${skipped} already stored, concurrency ${concurrency}\n`,
    )

    const llm = anthropicLlmClient(new Anthropic({ apiKey, maxRetries: SDK_MAX_RETRIES }))
    let total: TokenUsage = ZERO_USAGE
    const failures: string[] = []

    const results = await mapWithConcurrency(todo, concurrency, async (preset) => {
      const result = await generateNicheProfile(preset, { llm })
      total = addUsage(total, result.stats.usage)
      console.log(describeResult(preset, result))

      if (result.status === "ok") {
        // Presets keep their curated name/emoji so the catalog stays consistent.
        await repo.insert({
          profile: { ...result.profile, name: preset.name, emoji: preset.emoji },
          generatedBy: "seed",
          model: result.stats.model,
          inputTokens: result.stats.usage.inputTokens,
          outputTokens: result.stats.usage.outputTokens,
        })
      } else if (result.status === "rejected") {
        failures.push(`${preset.slug}: rejected (${result.reason})`)
      } else {
        failures.push(`${preset.slug}: invalid after retry\n${result.issues}`)
      }
      return result
    })

    results.forEach((settled, index) => {
      if (settled.status === "rejected") {
        const slug = todo[index].slug
        console.log(`✗ ${slug.padEnd(18)} error: ${errorMessage(settled.reason)}`)
        failures.push(`${slug}: ${errorMessage(settled.reason)}`)
      }
    })

    const created = results.filter(
      (r) => r.status === "fulfilled" && r.value.status === "ok",
    ).length
    console.log(`\ncreated ${created}, skipped ${skipped}, failed ${failures.length}`)
    console.log(
      `tokens: in ${total.inputTokens.toLocaleString()} / out ${total.outputTokens.toLocaleString()}  ≈ ${formatUsd(estimateCostUsd(NICHE_MODEL, total))} (${NICHE_MODEL})`,
    )
    if (failures.length > 0) {
      console.log(`\nfailures:\n${failures.map((f) => `  - ${f}`).join("\n")}`)
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
