import type Anthropic from "@anthropic-ai/sdk"
import type { LlmClient } from "@/lib/engine/generate"
import { type TokenUsage, estimateCostUsd } from "@/lib/engine/pricing"
import type { MixNiche } from "./data"

export const BLURB_MODEL = "claude-haiku-5-5"
const MAX_TOKENS = 200
const MIN_CHARS = 30
const MAX_CHARS = 320
const EMOJI = /\p{Extended_Pictographic}/gu

const SYSTEM = [
  "You write the result blurb for subcult's Vibe Check, a quiz that tells someone which internet subcultures they belong to.",
  "Write 2 short sentences, second person, funny Gen-Z voice: playful roast energy, never mean, never cringe.",
  "Reference the specific niches and what makes them distinct. No emojis, no hashtags, no quotation marks, no lists.",
  "Reply with the blurb text only.",
].join(" ")

export interface BlurbOutcome {
  text: string | null
  usage: TokenUsage
  costUsd: number | null
  status: "ok" | "invalid" | "error"
}

/** Trim, drop emoji/quotes, enforce length. Null when the output isn't usable. */
export function sanitizeBlurb(raw: string): string | null {
  const text = raw
    .replace(EMOJI, "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return text.length >= MIN_CHARS && text.length <= MAX_CHARS ? text : null
}

function prompt(mix: readonly MixNiche[]): string {
  const lines = mix.map((niche) => `- ${niche.name} (${niche.percent}%): ${niche.tagline}`)
  return `Their mix:\n${lines.join("\n")}\n\nWrite their blurb.`
}

/**
 * One cheap Haiku call for a personalized blurb. Never throws: any failure
 * reports status "error" and the caller keeps the template blurb.
 */
export async function generateVibeBlurb(
  llm: LlmClient,
  mix: readonly MixNiche[],
  model = BLURB_MODEL,
): Promise<BlurbOutcome> {
  let response: Anthropic.Message
  try {
    response = await llm.createMessage({
      model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt(mix) }],
    })
  } catch {
    return {
      text: null,
      usage: { inputTokens: 0, outputTokens: 0 },
      costUsd: null,
      status: "error",
    }
  }
  const usage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
  const raw = response.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join(" ")
  const text = sanitizeBlurb(raw)
  return { text, usage, costUsd: estimateCostUsd(model, usage), status: text ? "ok" : "invalid" }
}
