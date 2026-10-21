import { z } from "zod"
import artistsData from "../../../../../data/taxonomy/artists.json"
import brandsData from "../../../../../data/taxonomy/brands.json"
import { sameOrigin } from "@/lib/fits/route-helpers"
import { findPreset } from "@/lib/niches/catalog"
import { getLimiter } from "@/lib/rate-limit"
import { apiError, apiOk, clientIp } from "@/lib/request"
import { type SearchedEntity, logSearch, trendingSearches } from "@/lib/search/trending-server"

const SLUG = /^[a-z0-9-]{1,64}$/
const logSchema = z.object({
  kind: z.enum(["niche", "artist", "brand"]),
  slug: z.string().regex(SLUG),
})

/** The display name of a known entity, or null (unknown entities are never logged). */
function labelOf(kind: "niche" | "artist" | "brand", slug: string): string | null {
  if (kind === "niche") return findPreset(slug)?.name ?? null
  const list: readonly { slug: string; name: string }[] =
    kind === "artist" ? artistsData : brandsData
  return list.find((entity) => entity.slug === slug)?.name ?? null
}

/** GET → the week's trending searches (real counts, at least 5 searches each). */
export async function GET(): Promise<Response> {
  const trending = await trendingSearches().catch(() => [])
  return apiOk({
    trending: trending.flatMap(({ entity, count }) => {
      const [kind, slug] = entity.split(":") as ["niche" | "artist" | "brand", string]
      const label = labelOf(kind, slug)
      return label ? [{ kind, slug, label, count }] : []
    }),
  })
}

/** POST { kind, slug } → counts a search that led to a known niche, artist or brand. */
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return apiError("cross-site request refused", 403, "forbidden")
  const limit = await getLimiter("search-log", 30, "10 m").limit(clientIp(request.headers))
  if (!limit.success) return apiError("slow down a little", 429, "rate-limited")
  const parsed = logSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || !labelOf(parsed.data.kind, parsed.data.slug)) {
    return apiError("unknown entity", 400, "invalid-input")
  }
  await logSearch(`${parsed.data.kind}:${parsed.data.slug}` as SearchedEntity).catch(
    () => undefined,
  )
  return apiOk({ logged: true })
}
