"use client"

import { useState } from "react"
import type { AudioTrack } from "@/lib/audio/engine"
import { type EmbedController, spotifyUriFrom } from "@/lib/audio/spotify-embed"
import { getAudioEngine } from "@/lib/audio/use-audio"
import { SPOTIFY_CONNECT_ENABLED } from "@/lib/spotify-connect/flag"
import { playFullTrack, toggleFullTrack } from "@/lib/spotify-connect/player"
import { useSpotifySession } from "@/lib/spotify-connect/session"

export type FullSongMode = "sdk" | "embed"

/**
 * "Play full song" without leaving Now Playing. Connected listeners (flagged
 * beta) stream through the Web Playback SDK; everyone else gets Spotify's
 * embed, which plays the full track only if they're logged in to Premium.
 * Our play/pause button drives whichever is active.
 */
export function useFullSong(track: AudioTrack | null) {
  const session = useSpotifySession()
  const [activeFor, setActiveFor] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [embed, setEmbed] = useState<EmbedController | null>(null)
  const [error, setError] = useState<string | null>(null)

  const uri = spotifyUriFrom(track?.spotifyUrl)
  const mode: FullSongMode = SPOTIFY_CONNECT_ENABLED && session ? "sdk" : "embed"
  const active = uri !== null && track !== null && activeFor === track.id

  function start() {
    if (!uri || !track) return
    getAudioEngine().pause()
    setError(null)
    setActiveFor(track.id)
    if (mode === "sdk") {
      playFullTrack(uri)
        .then(() => setPlaying(true))
        .catch((reason: unknown) => {
          setActiveFor(null)
          setError(reason instanceof Error ? reason.message : "Spotify didn't start.")
        })
    }
  }

  function stop() {
    if (mode === "sdk" && playing) void toggleFullTrack()
    setActiveFor(null)
    setPlaying(false)
  }

  function toggle() {
    if (mode === "sdk") {
      void toggleFullTrack().then(() => setPlaying((value) => !value))
    } else {
      embed?.togglePlay()
    }
  }

  return {
    uri,
    mode,
    active,
    playing,
    error,
    start,
    stop,
    toggle,
    /** Props for <SpotifyEmbed> when mode is "embed". */
    embedProps: {
      onController: setEmbed,
      onUpdate: (update: { isPaused: boolean }) => setPlaying(!update.isPaused),
    },
  }
}
