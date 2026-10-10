"use client"

import { useSyncExternalStore } from "react"
import { type AudioEngine, type AudioState, createAudioEngine } from "./engine"

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
  })
  return engine
}

const SERVER_STATE: AudioState = { track: null, owner: null, playing: false, muted: false }

/** Re-renders on play, pause, track change and mute. */
export function useAudioState(): AudioState {
  return useSyncExternalStore(
    (listener) => getAudioEngine().subscribe(listener),
    () => getAudioEngine().getState(),
    () => SERVER_STATE,
  )
}
