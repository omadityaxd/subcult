"use client"

import { useSyncExternalStore } from "react"
import type { Soundtrack, SoundtrackTrack } from "@/lib/music/soundtrack"
import type { AudioTrack } from "./engine"
import { getAudioEngine } from "./use-audio"

export function toAudioTrack(track: SoundtrackTrack, niche: string | null): AudioTrack {
  return {
    id: track.id,
    src: track.previewUrl,
    title: track.title,
    artist: track.artist,
    artworkUrl: track.artworkUrl,
    spotifyUrl: track.spotifyUrl,
    appleUrl: track.appleUrl,
    niche,
  }
}

/** Play a soundtrack in the persistent player, from `index`. Call from a tap when possible. */
export function playSoundtrack(soundtrack: Soundtrack, index = 0): void {
  const engine = getAudioEngine()
  engine.unlock()
  engine.playQueue(
    soundtrack.tracks.map((track) => toAudioTrack(track, soundtrack.slug)),
    index,
    { owner: "player", context: soundtrack.title },
  )
}

/** True when this soundtrack is what the player is currently on. */
export function isSoundtrackLoaded(slug: string): boolean {
  const { owner, queue } = getAudioEngine().getState()
  return owner === "player" && queue.length > 0 && queue[0]?.niche === slug
}

// --- "Autoplay niche soundtrack" setting (Me → Settings), on by default ---

const AUTOPLAY_KEY = "subcult-autoplay-soundtrack"
const autoplayListeners = new Set<() => void>()

function readAutoplay(): boolean {
  try {
    return localStorage.getItem(AUTOPLAY_KEY) !== "0"
  } catch {
    return true
  }
}

export function setAutoplaySoundtrack(enabled: boolean): void {
  try {
    localStorage.setItem(AUTOPLAY_KEY, enabled ? "1" : "0")
  } catch {
    // Not remembered; the toggle still applies for this visit via listeners.
  }
  autoplayListeners.forEach((listener) => listener())
}

export function useAutoplaySoundtrack(): boolean {
  return useSyncExternalStore(
    (listener) => {
      autoplayListeners.add(listener)
      return () => autoplayListeners.delete(listener)
    },
    readAutoplay,
    () => true,
  )
}

export function autoplayEnabled(): boolean {
  return readAutoplay()
}

/**
 * Browsers only allow sound after the user has interacted with the page. An
 * in-app navigation (a tap on a card) counts; a cold direct visit doesn't.
 */
export function hasUserActivation(): boolean {
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
    .userActivation
  // Older browsers without the API: assume no, and show the tap-to-play pill.
  return activation?.hasBeenActive ?? false
}
