import { z } from "zod"
import type { Pin } from "./types"

/**
 * Image sources for the moodboard. Each one is optional; responses are
 * external data and get validated.
 *
 * - Are.na: public channel contents work without a key (guest: 30 req/min).
 *   Search is Premium-only, so niches list curated public channels instead.
 *   An optional personal access token raises the limit to 120/min.
 * - Unsplash: Client-ID key; hotlink their URLs, credit "Photo by X on
 *   Unsplash" with utm_source/utm_medium=referral links, ping
 *   download_location when a photo is saved. Demo apps: 50 req/hour.
 * - Pexels: API key; credit the photographer and Pexels. 200 req/hour.
 */

export const APP_NAME = "subcult"
const TIMEOUT_MS = 6_000

const utm = (url: string) => {
  const parsed = new URL(url)
  parsed.searchParams.set("utm_source", APP_NAME)
  parsed.searchParams.set("utm_medium", "referral")
  return parsed.toString()
}

async function getJson(url: string, headers: Record<string, string>, fetchImpl: typeof fetch) {
  const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!response.ok) throw new Error(`${new URL(url).hostname} ${response.status}`)
  return response.json() as Promise<unknown>
}

// --- Are.na ---------------------------------------------------------------

const arenaContentsSchema = z.object({
  data: z.array(
    z.object({
      id: z.number(),
      type: z.string(),
      title: z.string().nullable().optional(),
      image: z
        .object({
          src: z.string(),
          small: z.object({ src: z.string() }).optional(),
          medium: z.object({ src: z.string() }).optional(),
          width: z.number().nullable().optional(),
          height: z.number().nullable().optional(),
        })
        .nullable()
        .optional(),
      user: z.object({ name: z.string() }).nullable().optional(),
    }),
  ),
})

const ARENA_FILENAME = /\.(jpe?g|png|gif|webp)$/i

export async function arenaChannelPins(
  channel: string,
  {
    token,
    per = 40,
    fetchImpl = fetch,
  }: { token?: string; per?: number; fetchImpl?: typeof fetch },
): Promise<Omit<Pin, "color">[]> {
  const headers: Record<string, string> = { "User-Agent": `${APP_NAME}/1.0` }
  if (token) headers.Authorization = `Bearer ${token}`
  const body = arenaContentsSchema.parse(
    await getJson(
      `https://api.are.na/v3/channels/${encodeURIComponent(channel)}/contents?per=${per}`,
      headers,
      fetchImpl,
    ),
  )
  return body.data.flatMap((block) => {
    if (block.type !== "Image" || !block.image) return []
    const image = block.image
    const title = block.title && !ARENA_FILENAME.test(block.title) ? block.title : null
    return [
      {
        id: `arena:${block.id}`,
        source: "arena" as const,
        imageUrl: image.small?.src ?? image.src,
        largeUrl: image.medium?.src ?? image.src,
        width: image.width ?? null,
        height: image.height ?? null,
        title,
        credit: block.user
          ? {
              label: `Saved by ${block.user.name} on Are.na`,
              url: `https://www.are.na/block/${block.id}`,
            }
          : null,
        pageUrl: `https://www.are.na/block/${block.id}`,
      },
    ]
  })
}

// --- Unsplash ---------------------------------------------------------------

const unsplashSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      width: z.number(),
      height: z.number(),
      color: z.string().nullable().optional(),
      alt_description: z.string().nullable().optional(),
      urls: z.object({ small: z.string(), regular: z.string() }),
      links: z.object({ html: z.string(), download_location: z.string() }),
      user: z.object({ name: z.string(), links: z.object({ html: z.string() }) }),
    }),
  ),
})

export async function unsplashPins(
  query: string,
  { key, per = 12, fetchImpl = fetch }: { key: string; per?: number; fetchImpl?: typeof fetch },
): Promise<Pin[]> {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${per}&content_filter=high`
  const body = unsplashSchema.parse(
    await getJson(url, { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" }, fetchImpl),
  )
  return body.results.map((photo) => ({
    id: `unsplash:${photo.id}`,
    source: "unsplash" as const,
    imageUrl: photo.urls.small,
    largeUrl: photo.urls.regular,
    width: photo.width,
    height: photo.height,
    color: photo.color && /^#[0-9a-f]{6}$/i.test(photo.color) ? photo.color.toLowerCase() : null,
    title: photo.alt_description ?? null,
    credit: { label: `Photo by ${photo.user.name} on Unsplash`, url: utm(photo.user.links.html) },
    pageUrl: utm(photo.links.html),
    downloadLocation: photo.links.download_location,
  }))
}

// --- Pexels -----------------------------------------------------------------

const pexelsSchema = z.object({
  photos: z.array(
    z.object({
      id: z.number(),
      width: z.number(),
      height: z.number(),
      url: z.string(),
      alt: z.string().nullable().optional(),
      avg_color: z.string().nullable().optional(),
      photographer: z.string(),
      photographer_url: z.string(),
      src: z.object({ medium: z.string(), large: z.string() }),
    }),
  ),
})

export async function pexelsPins(
  query: string,
  { key, per = 12, fetchImpl = fetch }: { key: string; per?: number; fetchImpl?: typeof fetch },
): Promise<Pin[]> {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${per}`
  const body = pexelsSchema.parse(await getJson(url, { Authorization: key }, fetchImpl))
  return body.photos.map((photo) => ({
    id: `pexels:${photo.id}`,
    source: "pexels" as const,
    imageUrl: photo.src.medium,
    largeUrl: photo.src.large,
    width: photo.width,
    height: photo.height,
    color:
      photo.avg_color && /^#[0-9a-f]{6}$/i.test(photo.avg_color)
        ? photo.avg_color.toLowerCase()
        : null,
    title: photo.alt || null,
    credit: { label: `Photo by ${photo.photographer} on Pexels`, url: photo.photographer_url },
    pageUrl: photo.url,
  }))
}
