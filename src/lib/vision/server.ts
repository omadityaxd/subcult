import "server-only"
import { createHash } from "node:crypto"
import Anthropic from "@anthropic-ai/sdk"
import { anthropicLlmClient } from "@/lib/engine/generate"
import { getUsageLog } from "@/lib/engine/server"
import { startOfUtcDay } from "@/lib/engine/usage"
import { env } from "@/lib/env"
import { errorMessage, log } from "@/lib/log"
import { getCacheStore } from "@/lib/music/server"
import { VISION_BATCH, VISION_MODEL, type VisionTag, tagImageBatch, visionTagSchema } from "./tag"

/** An image's content doesn't change; re-tag rarely. */
const TAG_TTL_SECONDS = 90 * 24 * 3600
const LLM_TIMEOUT_MS = 30_000

const cacheKey = (url: string) =>
  `subcult:vision:v1:${createHash("sha256").update(url).digest("hex")}`

async function cachedTag(url: string): Promise<VisionTag | null> {
  try {
    const parsed = visionTagSchema.safeParse(await getCacheStore().get(cacheKey(url)))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** Batches still allowed today under VISION_DAILY_BATCH_CAP (0 when the ledger is unreadable). */
async function batchesLeftToday(): Promise<number> {
  const usage = getUsageLog()
  if (!usage) return 0
  try {
    const used = await usage.countSince("vision-tag", startOfUtcDay())
    return Math.max(0, env.VISION_DAILY_BATCH_CAP - used)
  } catch (error) {
    log.error("vision.budget_error", { error: errorMessage(error) })
    return 0
  }
}

/**
 * Tags for these image URLs: cached ones always, new ones only with
 * ANTHROPIC_API_KEY and within the daily vision cap. Each batch is logged to
 * llm_usage (purpose "vision-tag") with its cost. Never throws.
 */
export async function visionTags(
  urls: readonly string[],
  niche: { slug: string; name: string; description: string },
): Promise<Map<string, VisionTag>> {
  const unique = [...new Set(urls)]
  const found = await Promise.all(unique.map(async (url) => [url, await cachedTag(url)] as const))
  const tags = new Map<string, VisionTag>()
  for (const [url, tag] of found) if (tag) tags.set(url, tag)

  const missing = unique.filter((url) => !tags.has(url))
  if (missing.length === 0 || !env.ANTHROPIC_API_KEY) return tags
  const allowed = await batchesLeftToday()
  if (allowed === 0) return tags

  const llm = anthropicLlmClient(
    new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: LLM_TIMEOUT_MS, maxRetries: 1 }),
  )
  const batches: string[][] = []
  for (let i = 0; i < missing.length && batches.length < allowed; i += VISION_BATCH) {
    batches.push(missing.slice(i, i + VISION_BATCH))
  }
  // Sequential: the cap is checked once, and a niche's board is at most ~10 batches.
  for (const batch of batches) {
    const started = Date.now()
    const result = await tagImageBatch(
      llm,
      batch.map((url) => ({ url })),
      niche,
    )
    await Promise.all(
      batch.map(async (url, i) => {
        const tag = result.tags[i]
        if (!tag) return
        tags.set(url, tag)
        await getCacheStore()
          .set(cacheKey(url), tag, TAG_TTL_SECONDS)
          .catch(() => {})
      }),
    )
    try {
      await getUsageLog()?.record({
        purpose: "vision-tag",
        subject: `${niche.slug}:${batch.length}`,
        model: VISION_MODEL,
        status: result.status,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        attempts: 1,
        costUsd: result.costUsd,
        durationMs: Date.now() - started,
      })
    } catch (error) {
      log.error("vision.usage_error", { error: errorMessage(error) })
    }
  }
  return tags
}
