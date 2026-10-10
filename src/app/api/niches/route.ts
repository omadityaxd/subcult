import { z } from "zod"
import { getNicheService } from "@/lib/engine/server"
import { errorMessage, log } from "@/lib/log"
import { getNicheGenerationLimiter } from "@/lib/rate-limit"
import { apiError, apiOk, clientIp } from "@/lib/request"

const bodySchema = z.object({ name: z.string().max(200) })

export interface ResolvedNiche {
  slug: string
  name: string
  emoji: string
  tagline: string
  source: "cache" | "generated"
}

/**
 * POST /api/niches { name } → resolves any typed vibe to a niche, generating
 * (and caching forever) on first sight. Generation is rate-limited per IP;
 * cache hits are free.
 */
export async function POST(request: Request): Promise<Response> {
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return apiError("send { name: string }", 400)
  }

  const service = getNicheService()
  if (!service) return apiError("niches are offline rn. try again soon", 503)

  const ip = clientIp(request.headers)
  try {
    const result = await service.getOrCreate(body.name, {
      generatedBy: "anon",
      allowGeneration: async () => (await getNicheGenerationLimiter().limit(`ip:${ip}`)).success,
    })

    switch (result.status) {
      case "found": {
        const { profile } = result.niche
        const data: ResolvedNiche = {
          slug: profile.slug,
          name: profile.name,
          emoji: profile.emoji,
          tagline: profile.tagline,
          source: result.source,
        }
        return apiOk(data, result.source === "generated" ? 201 : 200)
      }
      case "invalid-input":
        return apiError(result.reason, 400)
      case "rejected":
        return apiError(result.reason, 422)
      case "rate-limited":
        return apiError(result.reason, 429)
      case "unavailable":
        return apiError(result.reason, 503)
      case "failed":
        return apiError(result.reason, 502)
    }
  } catch (error) {
    log.error("api.niches.error", { error: errorMessage(error) })
    return apiError("something broke on our end. try again?", 500)
  }
}
