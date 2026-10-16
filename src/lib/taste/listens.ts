import type { SignalKind } from "./model"

/** Previews are 30s: most of one is a play-through, a few seconds is a skip. */
export const PLAY_THROUGH_SECONDS = 25
export const SKIP_UNDER_SECONDS = 5

/** What a finished listen says: heard seconds → play, play-through or skip. */
export function listenSignal(seconds: number): SignalKind {
  if (seconds >= PLAY_THROUGH_SECONDS) return "play_through"
  return seconds >= SKIP_UNDER_SECONDS ? "play" : "skip"
}

export interface ListenSession {
  trackId: string
  artist: string
  niche: string | null
  seconds: number
}

/**
 * Folds the audio engine's per-tick listen deltas into one session per track.
 * Returns the finished session when a different track starts.
 */
export function accumulateListen(
  current: ListenSession | null,
  tick: { trackId: string; artist: string; niche: string | null; seconds: number },
): { current: ListenSession; finished: ListenSession | null } {
  if (current && current.trackId === tick.trackId) {
    return { current: { ...current, seconds: current.seconds + tick.seconds }, finished: null }
  }
  return { current: { ...tick }, finished: current }
}
