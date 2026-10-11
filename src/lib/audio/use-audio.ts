"use client"

import { useSyncExternalStore } from "react"
import { type AudioEngine, type AudioState, type Progress, createAudioEngine } from "./engine"

let engine: AudioEngine | null = null

function browserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** The app-wide engine, created on first use in the browser. */
export function getAudioEngine(): AudioEngine {
  engine ??= createAudioEngine({
    createAudio: () => new Audio(),
    createContext: () => {
      const Context =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      return Context ? new Context() : null
    },
    storage: browserStorage(),
    mediaSession: "mediaSession" in navigator ? navigator.mediaSession : null,
    createMetadata:
      typeof MediaMetadata === "undefined" ? undefined : (init) => new MediaMetadata(init),
  })
  return engine
}

const SERVER_STATE: AudioState = {
  track: null,
  owner: null,
  playing: false,
  muted: false,
  queue: [],
  index: -1,
  context: null,
}
const SERVER_PROGRESS: Progress = { position: 0, duration: 0 }

/** Re-renders on play, pause, track/queue change and mute (not on every tick). */
export function useAudioState(): AudioState {
  return useSyncExternalStore(
    (listener) => getAudioEngine().subscribe(listener),
    () => getAudioEngine().getState(),
    () => SERVER_STATE,
  )
}

/** Playback position, ~4×/s. Use only in the small components that draw it. */
export function useAudioProgress(): Progress {
  return useSyncExternalStore(
    (listener) => getAudioEngine().subscribeProgress(listener),
    () => getAudioEngine().getProgress(),
    () => SERVER_PROGRESS,
  )
}
