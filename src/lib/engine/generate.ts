import type Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"
import { addUsage, estimateCostUsd, type TokenUsage, ZERO_USAGE } from "./pricing"
import {
  type NicheProfile,
  type NicheProfileDraft,
  PROFILE_SCHEMA_VERSION,
  nicheGenerationOutputSchema,
} from "./profile-schema"
import { NICHE_SYSTEM_PROMPT, buildNicheUserPrompt, buildRepairPrompt } from "./prompt"

export const NICHE_MODEL = "claude-haiku-5-5"
const MAX_TOKENS = 16_000
/** One generation plus one repair attempt with the validation errors fed back. */
const MAX_ATTEMPTS = 2

export const DEFAULT_REJECTION = "we can't make a niche out of that one. try another vibe?"

const OUTPUT_FORMAT = zodOutputFormat(nicheGenerationOutputSchema)

/** The single SDK capability the engine needs; tests substitute a fake. */
export interface LlmClient {
  createMessage(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>
}

export function anthropicLlmClient(client: Anthropic): LlmClient {
  return { createMessage: (params) => client.messages.create(params) }
}

export interface GenerationStats {
  model: string
  usage: TokenUsage
  attempts: number
  costUsd: number | null
  durationMs: number
}

export type GenerationResult =
  | { status: "ok"; profile: NicheProfile; stats: GenerationStats }
  | { status: "rejected"; reason: string; stats: GenerationStats }
  | { status: "invalid"; issues: string; stats: GenerationStats }

type AttemptOutcome =
  | { kind: "ok"; draft: NicheProfileDraft }
  | { kind: "rejected"; reason: string }
  | { kind: "invalid"; issues: string }

export interface GenerateOptions {
  llm: LlmClient
  model?: string
}

/**
 * Asks Claude for a structured NicheProfile, validates it with Zod, and on a
 * validation failure retries once with the errors fed back. API errors
 * (after the SDK's own 429/529 backoff) propagate to the caller.
 */
export async function generateNicheProfile(
  niche: { name: string; slug: string },
  { llm, model = NICHE_MODEL }: GenerateOptions,
): Promise<GenerationResult> {
  const startedAt = Date.now()
  let usage = ZERO_USAGE
  let messages: Anthropic.MessageParam[] = [
    { role: "user", content: buildNicheUserPrompt(niche.name) },
  ]
  let lastIssues = ""

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await llm.createMessage({
      model,
      max_tokens: MAX_TOKENS,
      system: NICHE_SYSTEM_PROMPT,
      messages,
      output_config: { format: OUTPUT_FORMAT, effort: "medium" },
    })
    usage = addUsage(usage, {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    })
    const stats = (): GenerationStats => ({
      model,
      usage,
      attempts: attempt,
      costUsd: estimateCostUsd(model, usage),
      durationMs: Date.now() - startedAt,
    })

    const outcome = interpretResponse(response)
    if (outcome.kind === "ok") {
      const profile: NicheProfile = {
        ...outcome.draft,
        slug: niche.slug,
        schemaVersion: PROFILE_SCHEMA_VERSION,
      }
      return { status: "ok", profile, stats: stats() }
    }
    if (outcome.kind === "rejected")
      return { status: "rejected", reason: outcome.reason, stats: stats() }

    lastIssues = outcome.issues
    if (attempt === MAX_ATTEMPTS) return { status: "invalid", issues: lastIssues, stats: stats() }
    // Append-only: echo the full assistant turn back unchanged, then the repair request.
    messages = [
      ...messages,
      { role: "assistant", content: response.content },
      { role: "user", content: buildRepairPrompt(outcome.issues) },
    ]
  }

  // Unreachable: the loop always returns on its final attempt.
  throw new Error(`Niche generation ended without a result: ${lastIssues}`)
}

export function interpretResponse(response: Anthropic.Message): AttemptOutcome {
  if (response.stop_reason === "refusal") return { kind: "rejected", reason: DEFAULT_REJECTION }
  if (response.stop_reason === "max_tokens") {
    return {
      kind: "invalid",
      issues: "Output was cut off at max_tokens. Keep every field concise.",
    }
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { kind: "invalid", issues: "Response was not valid JSON." }
  }

  const parsed = nicheGenerationOutputSchema.safeParse(normalizeRawOutput(raw))
  if (!parsed.success) return { kind: "invalid", issues: z.prettifyError(parsed.error) }

  const output = parsed.data
  if (output.status === "rejected") {
    return { kind: "rejected", reason: output.rejectionReason?.trim() || DEFAULT_REJECTION }
  }
  if (!output.profile) return { kind: "invalid", issues: 'status is "ok" but profile is null.' }
  return { kind: "ok", draft: output.profile }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const mapStrings = (value: unknown, fn: (s: string) => string): unknown =>
  Array.isArray(value) ? value.map((item) => (typeof item === "string" ? fn(item) : item)) : value

/** Fixes harmless formatting slips (r/ prefixes, #hashtags) so they don't cost a retry. */
export function normalizeRawOutput(raw: unknown): unknown {
  if (!isRecord(raw) || !isRecord(raw.profile)) return raw
  const profile = raw.profile
  return {
    ...raw,
    profile: {
      ...profile,
      subreddits: mapStrings(profile.subreddits, (s) => s.trim().replace(/^\/?r\//i, "")),
      instagramHashtags: mapStrings(profile.instagramHashtags, (s) => s.trim().replace(/^#/, "")),
      palette: mapStrings(profile.palette, (s) => s.trim().toLowerCase()),
    },
  }
}
