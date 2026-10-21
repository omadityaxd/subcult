import { z } from "zod"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { checkGenerationBudget, getNicheService } from "@/lib/engine/server"
import { parseNicheInput } from "@/lib/engine/slug"
import { errorMessage, log } from "@/lib/log"
import { findSeedProfileByName } from "@/lib/niches/catalog"
import { apiError, apiOk, clientIp } from "@/lib/request"
import { ipLimited } from "@/lib/rate-limit"

const bodySchema = z.object({ name: z.string().max(200) })

export interface ResolvedNiche {
  slug: string
  name: string
  emoji: string
  tagline: string
  source: "seed" | "cache" | "generated"
}

/** Stable error codes the client branches on. */
export type NicheApiErrorCode =
  "invalid-input" | "rejected" | "rate-limited" | "capped" | "unavailable" | "failed"

const toResolved = (profile: NicheProfile, source: ResolvedNiche["source"]): ResolvedNiche => ({
  slug: profile.slug,
  name: profile.name,
  emoji: profile.emoji,
  tagline: profile.tagline,
  source,
})

/**
 * POST /api/niches { name } → resolves any typed vibe to a niche. Order:
 * bundled seed catalog incl. aliases (free, no DB) → Postgres cache → Claude generation,
 * which is gated by the global daily cap and a per-IP limit.
 */
export async function POST(request: Request): Promise<Response> {
  const limited = await ipLimited(request, "niche-summon", 20, "10 m")
  if (limited) return limited
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return apiError("send { name: string }", 400, "invalid-input")
  }

  const input = parseNicheInput(body.name)
  if (!input.ok) return apiError(input.reason, 400, "invalid-input")

  // Name, slug or alias ("opium fashion" → vamp): never generate a duplicate of a curated niche.
  const seed = findSeedProfileByName(input.name)
  if (seed) return apiOk(toResolved(seed, "seed"))

  const service = getNicheService()
  if (!service) return apiError("new niches are coming soon. try a preset!", 503, "unavailable")

  const ip = clientIp(request.headers)
  try {
    const result = await service.getOrCreate(input.name, {
      generatedBy: "anon",
      checkBudget: () => checkGenerationBudget(`ip:${ip}`),
    })

    switch (result.status) {
      case "found":
        return apiOk(
          toResolved(result.niche.profile, result.source),
          result.source === "generated" ? 201 : 200,
        )
      case "invalid-input":
        return apiError(result.reason, 400, result.status)
      case "rejected":
        return apiError(result.reason, 422, result.status)
      case "rate-limited":
      case "capped":
        return apiError(result.reason, 429, result.status)
      case "unavailable":
        return apiError(result.reason, 503, result.status)
      case "failed":
        return apiError(result.reason, 502, result.status)
    }
  } catch (error) {
    log.error("api.niches.error", { error: errorMessage(error) })
    return apiError("something broke on our end. try again?", 500, "failed")
  }
}
