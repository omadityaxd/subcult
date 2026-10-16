import type { GenerationStats } from "./generate"

export const USAGE_PURPOSES = [
  "niche-generation",
  "trend-refresh",
  "vibe-blurb",
  "vision-tag",
] as const
export type UsagePurpose = (typeof USAGE_PURPOSES)[number]

/** Request-path LLM jobs that share the global daily cap (LLM_DAILY_GENERATION_CAP). */
export const DAILY_CAPPED_PURPOSES: readonly UsagePurpose[] = ["niche-generation", "vibe-blurb"]

export const USAGE_STATUSES = ["ok", "rejected", "invalid", "error"] as const
export type UsageStatus = (typeof USAGE_STATUSES)[number]

/** One LLM job (a generation, including its repair attempt) as stored in llm_usage. */
export interface UsageEntry {
  purpose: UsagePurpose
  /** What the call was about, e.g. the niche slug. */
  subject: string
  model: string
  status: UsageStatus
  inputTokens: number
  outputTokens: number
  attempts: number
  costUsd: number | null
  durationMs: number
}

export interface UsageLog {
  record(entry: UsageEntry): Promise<void>
  /** Jobs logged for `purpose` since `since` (errors included: they may have spent tokens). */
  countSince(purpose: UsagePurpose, since: Date): Promise<number>
  /** Summed cost for `purpose` since `since`, in USD. */
  costSince(purpose: UsagePurpose, since: Date): Promise<number>
}

export function usageFromStats(
  purpose: UsagePurpose,
  subject: string,
  status: UsageStatus,
  stats: GenerationStats,
): UsageEntry {
  return {
    purpose,
    subject,
    model: stats.model,
    status,
    inputTokens: stats.usage.inputTokens,
    outputTokens: stats.usage.outputTokens,
    attempts: stats.attempts,
    costUsd: stats.costUsd,
    durationMs: stats.durationMs,
  }
}

/** Midnight UTC of the given instant's day: the daily cap's reset point. */
export function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}
