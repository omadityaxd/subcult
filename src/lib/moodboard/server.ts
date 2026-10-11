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
import { TAXONOMY, findSeedProfile } from "@/lib/niches/catalog"
import { assembleBoard } from "./board"
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
  const artist: RawPin[] = TAXONOMY.artistsOf(slug).flatMap((entry) =>
    entry.imageUrl
      ? [
          {
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
  return { slug, pins, disabled }
}

/** A niche's moodboard, built once and cached (with its colors). Memoized per request. */
export const getMoodboard = cache(async (slug: string): Promise<Moodboard> => {
  try {
    const { value } = await cached(
      getCacheStore(),
      `subcult:moodboard:v1:${slug}`,
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
