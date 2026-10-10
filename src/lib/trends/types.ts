import type { GenerationStats } from "@/lib/engine/generate"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import type { TrendSource } from "@/lib/niches/lifecycle"

/** One piece of evidence the trend engine can cite. Ids (s1, s2, …) are what Claude cites. */
export interface TrendSignal {
  id: string
  kind: "news" | "youtube" | "web"
  title: string
  url: string
  outlet: string | null
  publishedAt: Date | null
}

export type RawSignal = Omit<TrendSignal, "id">

/** A keyless (or key-gated) evidence feed, e.g. Google News RSS or YouTube search. */
export interface SignalSource {
  name: string
  gather(): Promise<RawSignal[]>
}

/** Claude-with-web-search research step: costs money, so the pipeline budgets it. */
export interface WebResearcher {
  estimateUsd: number
  run(): Promise<{ signals: RawSignal[]; stats: GenerationStats }>
}

/** What overlap detection compares a proposal against. */
export interface ExistingNiche {
  slug: string
  name: string
  relatedNiches: readonly string[]
}

export interface ProposalDecision {
  name: string
  slug: string
  whyNow: string
  trendScore: number
  sources: TrendSource[]
  accepted: boolean
  reason?: string
}

export interface NewTrendingNiche {
  profile: NicheProfile
  sources: TrendSource[]
  trendScore: number
  model: string
  inputTokens: number
  outputTokens: number
  publishedAt: Date
  expiresAt: Date
}

/** Persistence the pipeline needs; implemented over Drizzle in db/trend-repository. */
export interface TrendStore {
  listExisting(): Promise<ExistingNiche[]>
  findExpired(now: Date): Promise<string[]>
  archiveExpired(now: Date): Promise<string[]>
  listRefreshCandidates(olderThan: Date, limit: number): Promise<{ slug: string; name: string }[]>
  /** false when the slug already exists (never overwrites). */
  insertTrending(niche: NewTrendingNiche): Promise<boolean>
  updateProfile(slug: string, profile: NicheProfile, refreshedAt: Date): Promise<void>
}
