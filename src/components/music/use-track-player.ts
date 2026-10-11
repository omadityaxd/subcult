"use client"

import { useCallback, useState } from "react"
import { type PlayableTrack, playTracks } from "@/lib/audio/play-tracks"
import { getAudioEngine, useAudioState } from "@/lib/audio/use-audio"

/**
 * Tap-to-play for any list of tracks: toggles the current one, otherwise
 * plays from the tapped row. Remembers rows with no preview so the UI can
 * say so instead of silently doing nothing.
 */
export function useTrackPlayer(tracks: readonly PlayableTrack[], context: string | null) {
  const state = useAudioState()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [missing, setMissing] = useState<ReadonlySet<string>>(() => new Set())
  const currentId = state.owner === "player" ? (state.track?.id ?? null) : null

  const play = useCallback(
    (index: number) => {
      const track = tracks[index]
      if (!track) return
      if (track.id === currentId) {
        getAudioEngine().toggle()
        return
      }
      setPendingId(track.id)
      void playTracks(tracks, index, context).then((result) => {
        setPendingId((id) => (id === track.id ? null : id))
        if (result === "no-preview") setMissing((prev) => new Set([...prev, track.id]))
      })
    },
    [tracks, context, currentId],
  )

  return { play, currentId, playing: state.playing, pendingId, missing }
}
