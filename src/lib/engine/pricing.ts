/** USD per 1M tokens (Anthropic first-party rates, prompts ≤100K tokens). */
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
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

/** Returns null for models without a known price rather than guessing. */
export function estimateCostUsd(model: string, usage: TokenUsage): number | null {
  const price = PRICING[model]
  if (!price) return null
  return (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000
}

export function formatUsd(amount: number | null): string {
  if (amount === null) return "$?"
  return amount < 0.01 ? `$${amount.toFixed(4)}` : `$${amount.toFixed(2)}`
}
