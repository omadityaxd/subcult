import "server-only"
import { cache } from "react"
import { mapWithConcurrency } from "@/lib/concurrency"
import { appFeedDeps } from "@/lib/feed/app-deps"
import { cached } from "@/lib/feed/cache"
import { buildNicheFeed } from "@/lib/feed/feed"
import { env } from "@/lib/env"
import { errorMessage, log } from "@/lib/log"
import { getCacheStore } from "@/lib/music/server"
import { getSoundtrack } from "@/lib/music/soundtrack-server"
import { TAXONOMY, findSeedProfile, nicheArtistsLeadFirst } from "@/lib/niches/catalog"
import { assembleBoard } from "./board"
import { visionTags } from "@/lib/vision/server"
import { canBeCover } from "@/lib/vision/tag"
import { dominantColor } from "./dominant-color"
import { arenaChannelPins, pexelsPins, unsplashPins } from "./sources"
import type { Moodboard, Pin, PinSource } from "./types"

/** Boards change slowly; colors are the expensive part, so cache generously. */
const BOARD_POLICY = { freshSeconds: 12 * 3600, staleSeconds: 7 * 24 * 3600 }
const QUERIES = 2
const COLOR_WORKERS = 6

type RawPin = Omit<Pin, "color"> & { color?: string | null }

/** Search terms: the niche's Pinterest queries, then its vibe words. */
function boardQueries(pinterestQueries: readonly string[], vibeWords: readonly string[]) {
  return [...pinterestQueries, ...vibeWords].slice(0, QUERIES)
}

async function settledPins(
  label: string,
  jobs: readonly (() => Promise<RawPin[]>)[],
): Promise<RawPin[]> {
  const results = await Promise.allSettled(jobs.map((job) => job()))
  return results.flatMap((result) => {
    if (result.status === "fulfilled") return result.value
    log.warn("moodboard.source_failed", { source: label, error: errorMessage(result.reason) })
    return []
  })
}

/** Our own imagery: soundtrack album art, verified artist photos, video stills. */
async function ownPins(
  slug: string,
): Promise<{ album: RawPin[]; artist: RawPin[]; video: RawPin[] }> {
  const profile = findSeedProfile(slug)
  const [soundtrack, feed] = await Promise.all([
    getSoundtrack(slug),
    profile ? buildNicheFeed(profile, appFeedDeps()).catch(() => null) : null,
  ])
  const album: RawPin[] = (soundtrack?.tracks ?? []).flatMap((track) =>
    track.artworkUrl
      ? [
          {
            id: `album:${track.id}`,
            source: "album" as const,
            imageUrl: track.artworkUrl,
            largeUrl: track.artworkUrl.replace(/\/\d+x\d+bb\./, "/600x600bb."),
            width: 600,
            height: 600,
            title: `${track.title} · ${track.artist}`,
            credit: null,
            pageUrl: track.spotifyUrl,
          },
        ]
      : [],
  )
  const lookup = (name: string) => name.toLowerCase()
  const why = new Map((profile?.artists ?? []).map((a) => [lookup(a.name), a.why]))
  const wearing = (artistSlug: string) => {
    const brand = TAXONOMY.allBrands().find((b) => b.wornBy.some((w) => w.artist === artistSlug))
    return brand ? { slug: brand.slug, name: brand.name } : null
  }
  // Lead first: the niche's face (a readable portrait) opens the looks.
  const artist: RawPin[] = nicheArtistsLeadFirst(slug).flatMap((entry) =>
    entry.imageUrl
      ? [
          {
            note: why.get(lookup(entry.name)) ?? null,
            wearing: wearing(entry.slug),
            id: `artist:${entry.slug}`,
            source: "artist" as const,
            imageUrl: entry.imageUrl,
            largeUrl: entry.imageUrl,
            width: null,
            height: null,
            title: entry.name,
            credit: null,
            pageUrl: `https://open.spotify.com/artist/${entry.spotifyId}`,
          },
        ]
      : [],
  )
  const video: RawPin[] = (feed?.bySource.youtube ?? []).flatMap((item) =>
    item.imageUrl
      ? [
          {
            id: `video:${item.id}`,
            source: "video" as const,
            imageUrl: item.imageUrl,
            largeUrl: item.imageUrl,
            width: 480,
            height: 360,
            title: item.title,
            credit: item.subtitle ? { label: item.subtitle, url: item.url } : null,
            pageUrl: item.url,
          },
        ]
      : [],
  )
  return { album, artist, video }
}

/** External images we didn't make: these need a vision tag before they reach a feed. */
const TAGGED_SOURCES: ReadonlySet<PinSource> = new Set(["arena", "unsplash", "pexels"])

/** Attach vision tags; tagged low-quality pins sink to the back so they never lead the board. */
async function withVision(
  pins: readonly Pin[],
  profile: { slug: string; name: string; description: string; vibeWords: readonly string[] },
): Promise<Pin[]> {
  const urls = pins.filter((pin) => TAGGED_SOURCES.has(pin.source)).map((pin) => pin.imageUrl)
  const tags = await visionTags(urls, {
    slug: profile.slug,
    name: profile.name,
    description: `${profile.description} Looks: ${profile.vibeWords.join(", ")}.`,
  })
  const tagged = pins.map((pin) => {
    const tag = tags.get(pin.imageUrl)
    return tag ? { ...pin, vision: tag } : pin
  })
  const weak = (pin: Pin) => (pin.vision ? !canBeCover(pin.vision) : false)
  return [...tagged.filter((pin) => !weak(pin)), ...tagged.filter(weak)]
}

async function buildMoodboard(slug: string): Promise<Moodboard> {
  const profile = findSeedProfile(slug)
  if (!profile) return { slug, pins: [], disabled: [] }
  const queries = boardQueries(profile.pinterestQueries, profile.vibeWords)
  const channels = TAXONOMY.curation(slug)?.arenaChannels ?? []
  const disabled: PinSource[] = []
  if (!env.UNSPLASH_ACCESS_KEY) disabled.push("unsplash")
  if (!env.PEXELS_API_KEY) disabled.push("pexels")

  const [arena, unsplash, pexels, own] = await Promise.all([
    settledPins(
      "arena",
      channels.map((channel) => () => arenaChannelPins(channel, { token: env.ARENA_ACCESS_TOKEN })),
    ),
    env.UNSPLASH_ACCESS_KEY
      ? settledPins(
          "unsplash",
          queries.map(
            (query) => () => unsplashPins(query, { key: env.UNSPLASH_ACCESS_KEY as string }),
          ),
        )
      : [],
    env.PEXELS_API_KEY
      ? settledPins(
          "pexels",
          queries.map((query) => () => pexelsPins(query, { key: env.PEXELS_API_KEY as string })),
        )
      : [],
    ownPins(slug),
  ])

  const board = assembleBoard(
    [arena, unsplash, pexels, own.album, own.video, own.artist].map((list) =>
      list.map((pin) => ({ ...pin, color: pin.color ?? null })),
    ),
  )
  // Dominant colors at ingest: sources that report one (Unsplash, Pexels) are trusted.
  const colored = await mapWithConcurrency(board, COLOR_WORKERS, async (pin) =>
    pin.color ? pin : { ...pin, color: await dominantColor(pin.imageUrl) },
  )
  const pins = colored.flatMap((result, i) =>
    result.status === "fulfilled" ? [result.value] : [board[i]],
  )
  return { slug, pins: await withVision(pins, profile), disabled }
}

/** A niche's moodboard, built once and cached (with its colors). Memoized per request. */
export const getMoodboard = cache(async (slug: string): Promise<Moodboard> => {
  try {
    const { value } = await cached(
      getCacheStore(),
      `subcult:moodboard:v3:${slug}`,
      BOARD_POLICY,
      () => buildMoodboard(slug),
      {
        onStoreError: (operation, error) =>
          log.warn("moodboard.cache_error", { operation, error: errorMessage(error) }),
      },
    )
    return value
  } catch (error) {
    log.warn("moodboard.failed", { slug, error: errorMessage(error) })
    return { slug, pins: [], disabled: [] }
  }
})

const BRAND_PINS = 9

/**
 * A brand's visual board: Unsplash/Pexels photography for the brand name
 * (never its logo as artwork). Empty when neither key is configured.
 */
export async function getBrandBoard(brandName: string, brandSlug: string): Promise<Pin[]> {
  const jobs: (() => Promise<Pin[]>)[] = []
  if (env.UNSPLASH_ACCESS_KEY) {
    const key = env.UNSPLASH_ACCESS_KEY
    jobs.push(() => unsplashPins(`${brandName} fashion`, { key, per: BRAND_PINS }))
  }
  if (env.PEXELS_API_KEY) {
    const key = env.PEXELS_API_KEY
    jobs.push(() => pexelsPins(`${brandName} fashion`, { key, per: BRAND_PINS }))
  }
  if (jobs.length === 0) return []
  try {
    const { value } = await cached(
      getCacheStore(),
      `subcult:moodboard:v1:brand:${brandSlug}`,
      BOARD_POLICY,
      async () => assembleBoard(await Promise.all(jobs.map((job) => job().catch(() => [])))),
    )
    return value.slice(0, BRAND_PINS)
  } catch (error) {
    log.warn("moodboard.brand_failed", { brandSlug, error: errorMessage(error) })
    return []
  }
}
