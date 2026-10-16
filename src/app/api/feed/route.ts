import { z } from "zod"
import { getHomePage, getStory } from "@/lib/feed/home"
import { errorMessage, log } from "@/lib/log"
import { apiError, apiOk } from "@/lib/request"

const querySchema = z.union([
  z.object({ niche: z.string().regex(/^[a-z0-9-]{1,64}$/) }),
  z.object({
    cursor: z.coerce.number().int().min(0).max(500),
    /** The person's top niche affinities: "rage:5.2,jerk:3". */
    taste: z
      .string()
      .regex(
        /^([a-z0-9-]{1,64}:-?\d{1,4}(\.\d{1,3})?)(,[a-z0-9-]{1,64}:-?\d{1,4}(\.\d{1,3})?){0,19}$/,
      )
      .optional(),
  }),
])

function parseTaste(raw: string | undefined): Map<string, number> | null {
  if (!raw) return null
  return new Map(
    raw.split(",").map((pair) => {
      const [slug, score] = pair.split(":")
      return [slug, Number(score)] as const
    }),
  )
}

/**
 * GET /api/feed?cursor=N → one page of the infinite home feed.
 * GET /api/feed?niche=slug → story frames for one niche.
 * Both are served from the per-source Redis cache, so pages are cheap.
 */
export async function GET(request: Request): Promise<Response> {
  const params = Object.fromEntries(new URL(request.url).searchParams)
  const parsed = querySchema.safeParse(params)
  if (!parsed.success) return apiError("pass ?cursor=N or ?niche=slug", 400, "invalid-input")

  try {
    if ("niche" in parsed.data) {
      const story = await getStory(parsed.data.niche)
      return story ? apiOk(story) : apiError("no such niche", 404, "invalid-input")
    }
    const page = await getHomePage(parsed.data.cursor, new Date(), parseTaste(parsed.data.taste))
    return page ? apiOk(page) : apiOk({ niche: null, items: [], nextCursor: null })
  } catch (error) {
    log.error("api.feed.error", { error: errorMessage(error) })
    return apiError("couldn't load the feed", 500, "failed")
  }
}
