"use client"

import { getAudioEngine } from "./use-audio"

/**
 * Exactly one thing makes sound. The audio engine is one source; embedded
 * players (Spotify embed, an unmuted YouTube video) register here. When any
 * of them starts, every other one pauses, the engine included.
 */
interface ExternalPlayer {
  pause: () => void
}

const players = new Map<string, ExternalPlayer>()
let watching = false
let engineWasPlaying = false

function watchEngine() {
  if (watching) return
  watching = true
  const engine = getAudioEngine()
  engineWasPlaying = engine.getState().playing
  engine.subscribe(() => {
    const { playing } = engine.getState()
    if (playing && !engineWasPlaying) pauseExternal(null)
    engineWasPlaying = playing
  })
}

function pauseExternal(except: string | null) {
  for (const [id, player] of players) {
    if (id === except) continue
    try {
      player.pause()
    } catch {
      // A player that already tore itself down; nothing to pause.
    }
  }
}

/** Register an embedded player; returns an unregister function. */
export function registerExternalPlayer(id: string, player: ExternalPlayer): () => void {
  watchEngine()
  players.set(id, player)
  return () => {
    players.delete(id)
  }
}

/** Call when an embedded player starts making sound: everything else goes quiet. */
export function externalPlaybackStarted(id: string): void {
  watchEngine()
  pauseExternal(id)
  const engine = getAudioEngine()
  if (engine.getState().playing) engine.pause()
}
