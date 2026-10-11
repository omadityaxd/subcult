import { z } from "zod"
import { getSoundtrack } from "@/lib/music/soundtrack-server"
import { apiError, apiOk } from "@/lib/request"

const querySchema = z.object({ niche: z.string().regex(/^[a-z0-9-]{1,64}$/) })

/** GET /api/music/soundtrack?niche=slug → the niche's playable soundtrack. */
export async function GET(request: Request): Promise<Response> {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return apiError("pass ?niche=slug", 400, "invalid-input")
  const soundtrack = await getSoundtrack(parsed.data.niche)
  return soundtrack ? apiOk(soundtrack) : apiError("no such niche", 404, "invalid-input")
}
