"use client"

import { useSyncExternalStore } from "react"
import { spotifyUriFrom } from "./spotify-embed"

/** A track with no 30s preview, playing through Spotify's embed instead. */
export interface SpotifyFallbackTrack {
  title: string
  artist: string
  artworkUrl: string | null
  uri: string
}

let current: SpotifyFallbackTrack | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

/**
 * Opens the in-app Spotify sheet for a track without a preview. False when
 * the track has no exact Spotify track link (a search link can't embed).
 */
export function openSpotifyFallback(track: {
  title: string
  artist: string
  artworkUrl?: string | null
  spotifyUrl?: string | null
}): boolean {
  const uri = spotifyUriFrom(track.spotifyUrl)
  if (!uri?.startsWith("spotify:track:")) return false
  current = { title: track.title, artist: track.artist, artworkUrl: track.artworkUrl ?? null, uri }
  emit()
  return true
}

export function closeSpotifyFallback(): void {
  current = null
  emit()
}

export function useSpotifyFallback(): SpotifyFallbackTrack | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
    () => null,
  )
}
