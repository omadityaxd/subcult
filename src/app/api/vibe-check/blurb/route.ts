import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { anthropicLlmClient } from "@/lib/engine/generate"
import { checkGenerationBudget, getUsageLog } from "@/lib/engine/server"
import { env } from "@/lib/env"
import { errorMessage, log } from "@/lib/log"
import { clientIp, apiError, apiOk } from "@/lib/request"
import { BLURB_MODEL, generateVibeBlurb } from "@/lib/vibe/blurb"
import { describeMix, isCuratedNiche } from "@/lib/vibe/data"
import { decodeMix, encodeMix } from "@/lib/vibe/score"

const bodySchema = z.object({
  mix: z
    .array(z.object({ slug: z.string().max(64), percent: z.number().int().min(1).max(100) }))
    .min(1)
    .max(3),
})

const LLM_TIMEOUT_MS = 15_000

/**
 * POST /api/vibe-check/blurb { mix } → { blurb } personalized by Claude Haiku,
 * or { blurb: null } to keep the template (no key, over the daily cap,
 * rate-limited, or anything failing). Never an error the user sees.
 */
export async function POST(request: Request): Promise<Response> {
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return apiError("send { mix: [{ slug, percent }] }", 400, "invalid-input")
  }
  // Same validation as share links: known niches only, percents sum to 100.
  const mix = decodeMix(encodeMix(body.mix), isCuratedNiche)
  if (!mix) return apiError("unknown niche mix", 400, "invalid-input")

  if (!env.ANTHROPIC_API_KEY) return apiOk({ blurb: null })
  const permit = await checkGenerationBudget(`vibe:${clientIp(request.headers)}`)
  if (permit !== "ok") return apiOk({ blurb: null })

  const llm = anthropicLlmClient(
    new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: LLM_TIMEOUT_MS, maxRetries: 1 }),
  )
  const started = Date.now()
  const outcome = await generateVibeBlurb(llm, describeMix(mix))
  try {
    await getUsageLog()?.record({
      purpose: "vibe-blurb",
      subject: encodeMix(mix),
      model: BLURB_MODEL,
      status: outcome.status,
      inputTokens: outcome.usage.inputTokens,
      outputTokens: outcome.usage.outputTokens,
      attempts: 1,
      costUsd: outcome.costUsd,
      durationMs: Date.now() - started,
    })
  } catch (error) {
    log.error("vibe.blurb.usage_error", { error: errorMessage(error) })
  }
  return apiOk({ blurb: outcome.text })
}
