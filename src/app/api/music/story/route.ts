import { z } from "zod"
import { errorMessage, log } from "@/lib/log"
import { getStoryMusic } from "@/lib/music/story-server"
import { apiError, apiOk } from "@/lib/request"

const querySchema = z.object({ niche: z.string().regex(/^[a-z0-9-]{1,64}$/) })

/**
 * GET /api/music/story?niche=slug → { music } for a story's background track
 * (null = play silently). Fetched alongside the story frames, never blocking them.
 */
export async function GET(request: Request): Promise<Response> {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return apiError("pass ?niche=slug", 400, "invalid-input")
  try {
    return apiOk({ music: await getStoryMusic(parsed.data.niche) })
  } catch (error) {
    // Music is a nice-to-have: any failure means a silent story, not an error screen.
    log.warn("api.music.story_failed", { niche: parsed.data.niche, error: errorMessage(error) })
    return apiOk({ music: null })
  }
}
