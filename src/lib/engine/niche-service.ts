import { type Logger, errorMessage } from "@/lib/log"
import type { GenerationResult } from "./generate"
import type { NicheProfile } from "./profile-schema"
import { parseNicheInput } from "./slug"

export const GENERATED_BY = ["seed", "user", "anon"] as const
export type GeneratedBy = (typeof GENERATED_BY)[number]

export interface StoredNiche {
  slug: string
  name: string
  profile: NicheProfile
  generatedBy: GeneratedBy
  createdAt: Date
}

export interface NewNiche {
  profile: NicheProfile
  generatedBy: GeneratedBy
  model: string
  inputTokens: number
  outputTokens: number
}

export interface NicheRepository {
  findBySlug(slug: string): Promise<StoredNiche | null>
  /** Inserts unless the slug already exists; always returns the stored row. */
  insert(niche: NewNiche): Promise<StoredNiche>
  listSlugs(): Promise<string[]>
}

export type NicheGenerator = (niche: { name: string; slug: string }) => Promise<GenerationResult>

export type NicheLookup =
  | { status: "found"; niche: StoredNiche; source: "cache" | "generated" }
  | { status: "invalid-input"; reason: string }
  | { status: "rejected"; reason: string }
  | { status: "rate-limited"; reason: string }
  | { status: "unavailable"; reason: string }
  | { status: "failed"; reason: string }

export interface NicheServiceDeps {
  repo: NicheRepository
  /** null when no LLM is configured: cached niches still resolve. */
  generate: NicheGenerator | null
  logger: Logger
}

export interface GetOrCreateOptions {
  generatedBy: GeneratedBy
  /** Consulted only on a cache miss, right before spending tokens (rate limiting). */
  allowGeneration?: () => Promise<boolean>
}

export interface NicheService {
  getOrCreate(rawName: unknown, options: GetOrCreateOptions): Promise<NicheLookup>
}

/**
 * Cache-first niche resolution: Postgres is the cache and the LLM runs at most
 * once per slug. Concurrent requests for the same new slug share one generation.
 */
export function createNicheService({ repo, generate, logger }: NicheServiceDeps): NicheService {
  const inFlight = new Map<string, Promise<NicheLookup>>()

  async function generateAndStore(
    niche: { name: string; slug: string },
    { generatedBy, allowGeneration }: GetOrCreateOptions,
  ): Promise<NicheLookup> {
    if (!generate) {
      return { status: "unavailable", reason: "new niches are offline rn. try one from explore!" }
    }
    if (allowGeneration && !(await allowGeneration())) {
      return {
        status: "rate-limited",
        reason: "you've summoned a lot of niches today. come back tomorrow 🌙",
      }
    }

    let result: GenerationResult
    try {
      result = await generate(niche)
    } catch (error) {
      logger.error("niche.generate.error", { slug: niche.slug, error: errorMessage(error) })
      return { status: "failed", reason: "the vibe machine hiccuped. try again in a sec" }
    }

    const { stats } = result
    logger.info("niche.generate", {
      slug: niche.slug,
      status: result.status,
      generatedBy,
      model: stats.model,
      inputTokens: stats.usage.inputTokens,
      outputTokens: stats.usage.outputTokens,
      attempts: stats.attempts,
      costUsd: stats.costUsd,
      durationMs: stats.durationMs,
    })

    if (result.status === "rejected") return { status: "rejected", reason: result.reason }
    if (result.status === "invalid") {
      logger.warn("niche.generate.invalid", { slug: niche.slug, issues: result.issues })
      return { status: "failed", reason: "we couldn't pin that vibe down. try rephrasing?" }
    }

    const stored = await repo.insert({
      profile: result.profile,
      generatedBy,
      model: stats.model,
      inputTokens: stats.usage.inputTokens,
      outputTokens: stats.usage.outputTokens,
    })
    return { status: "found", niche: stored, source: "generated" }
  }

  return {
    async getOrCreate(rawName, options) {
      const input = parseNicheInput(rawName)
      if (!input.ok) return { status: "invalid-input", reason: input.reason }

      const cached = await repo.findBySlug(input.slug)
      if (cached) return { status: "found", niche: cached, source: "cache" }

      const pending = inFlight.get(input.slug)
      if (pending) return pending

      const work = generateAndStore(input, options).finally(() => inFlight.delete(input.slug))
      inFlight.set(input.slug, work)
      return work
    },
  }
}
