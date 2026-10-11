"use client"

import type { PreviewsResponse } from "@/app/api/music/previews/route"
import type { FeedItem } from "@/lib/feed/types"
import type { Preview } from "@/lib/music/itunes"
import type { PlayableTrack } from "@/lib/music/playable"
import type { ApiResponse } from "@/lib/request"
import type { AudioTrack } from "./engine"
import { getAudioEngine } from "./use-audio"

export type { PlayableTrack }

export type PlayResult = "playing" | "no-preview"

const LOOKUP_BATCH = 20
// Per-session memo: null = looked up, no exact preview exists.
const resolved = new Map<string, Preview | null>()
const keyOf = (track: Pick<PlayableTrack, "title" | "artist">) =>
  `${track.artist.toLowerCase()}|${track.title.toLowerCase()}`

async function lookupPreviews(tracks: readonly PlayableTrack[]): Promise<void> {
  const missing = tracks.filter((track) => !track.previewUrl && !resolved.has(keyOf(track)))
  for (let start = 0; start < missing.length; start += LOOKUP_BATCH) {
    const batch = missing.slice(start, start + LOOKUP_BATCH)
    try {
      const response = await fetch("/api/music/previews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracks: batch.map(({ title, artist }) => ({ title, artist })),
        }),
      })
      const body = (await response.json()) as ApiResponse<PreviewsResponse>
      if (!body.success) return
      batch.forEach((track, i) => resolved.set(keyOf(track), body.data.previews[i] ?? null))
    } catch {
      // Offline or rate-limited: leave them unresolved so a later tap can retry.
      return
    }
  }
}

function toAudio(track: PlayableTrack): AudioTrack | null {
  const preview = track.previewUrl ? null : resolved.get(keyOf(track))
  const src = track.previewUrl ?? preview?.previewUrl
  if (!src) return null
  return {
    id: track.id,
    src,
    title: track.title,
    artist: track.artist,
    artworkUrl: track.artworkUrl ?? preview?.artworkUrl ?? null,
    spotifyUrl: track.spotifyUrl,
    appleUrl: track.appleUrl ?? preview?.appleUrl ?? null,
    niche: track.niche ?? null,
  }
}

/**
 * Plays `tracks[index]` in the persistent player and queues the rest.
 * Call it straight from a tap: the engine is unlocked synchronously (iOS),
 * then any missing previews are looked up. Tracks without an exact preview
 * are skipped; if the tapped one has none, nothing changes.
 */
export async function playTracks(
  tracks: readonly PlayableTrack[],
  index: number,
  context: string | null,
): Promise<PlayResult> {
  const engine = getAudioEngine()
  engine.unlock()
  await lookupPreviews(tracks)
  const target = toAudio(tracks[index])
  if (!target) return "no-preview"
  const queue = tracks.flatMap((track) => toAudio(track) ?? [])
  engine.playQueue(
    queue,
    queue.findIndex((track) => track.id === target.id),
    { owner: "player", context },
  )
  return "playing"
}

/** A music feed item as a playable track. */
export function feedItemTrack(item: FeedItem): PlayableTrack {
  const string = (value: unknown) => (typeof value === "string" ? value : null)
  return {
    id: item.id,
    title: item.title,
    artist: item.subtitle ?? "",
    artworkUrl: item.imageUrl,
    spotifyUrl: item.url,
    previewUrl: string(item.meta.previewUrl),
    appleUrl: string(item.meta.appleUrl),
    niche: string(item.meta.niche),
  }
}
