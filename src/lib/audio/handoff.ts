"use client"

import { type ExternalPlayer, createMediaCoordinator } from "./media-coordinator"
import { getAudioEngine } from "./use-audio"

/**
 * The app-wide media coordinator (see media-coordinator.ts): one source of
 * sound at a time, across the audio engine and every embedded player.
 */
const coordinator = createMediaCoordinator(getAudioEngine)

/** Register an embedded player; returns an unregister function. */
export function registerExternalPlayer(id: string, player: ExternalPlayer): () => void {
  return coordinator.register(id, player)
}

/** Call when an embedded player starts making sound: everything else goes quiet. */
export function externalPlaybackStarted(id: string): void {
  coordinator.started(id)
}

/** Call when an embedded player pauses or ends. */
export function externalPlaybackStopped(id: string): void {
  coordinator.stopped(id)
}

/** Anything audible right now (the engine or an embed)? Autoplay must not interrupt it. */
export function isAnythingPlaying(): boolean {
  return coordinator.isAnythingPlaying()
}
