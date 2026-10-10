interface Rate {
  /** USD per 1M input tokens. */
  input: number
  /** USD per 1M output tokens. */
  output: number
}

interface ModelPricing {
  standard: Rate
  /** Higher rate applied to a whole request once its prompt exceeds the threshold. */
  longContext?: Rate & { thresholdTokens: number }
}

/**
 * Anthropic first-party rates, checked against the pricing page (Oct 2026):
 * Claude Haiku 5.5 is $0.10 / $0.50 per MTok up to 100K prompt tokens,
 * $0.50 / $2.50 beyond.
 */
const PRICING: Record<string, ModelPricing> = {
  "claude-haiku-5-5": {
    standard: { input: 0.1, output: 0.5 },
    longContext: { thresholdTokens: 100_000, input: 0.5, output: 2.5 },
  },
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

export const ZERO_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0 }

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
  }
}

/**
 * Cost of ONE request (the long-context tier depends on that request's prompt
 * size, so sum per-request costs rather than pricing aggregated usage).
 * Returns null for models without a known price rather than guessing.
 */
export function estimateCostUsd(model: string, usage: TokenUsage): number | null {
  const pricing = PRICING[model]
  if (!pricing) return null
  const { longContext } = pricing
  const rate =
    longContext && usage.inputTokens > longContext.thresholdTokens ? longContext : pricing.standard
  return (usage.inputTokens * rate.input + usage.outputTokens * rate.output) / 1_000_000
}

/** null-propagating sum: an unknown price anywhere makes the total unknown. */
export function addCost(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a + b
}

export function formatUsd(amount: number | null): string {
  if (amount === null) return "$?"
  return amount < 0.01 ? `$${amount.toFixed(4)}` : `$${amount.toFixed(2)}`
}
