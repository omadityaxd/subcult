"use client"

import { externalPlaybackStarted, registerExternalPlayer } from "@/lib/audio/handoff"
import { getAccessToken } from "./session"

/**
 * Spotify Web Playback SDK: full songs, streamed into this tab as a Spotify
 * Connect device. Premium only, and while the app is in development mode
 * Spotify allows just 5 allowlisted accounts.
 */
const SDK_SRC = "https://sdk.scdn.co/spotify-player.js"
const API = "https://api.spotify.com/v1"

interface SdkPlayer {
  connect(): Promise<boolean>
  disconnect(): void
  pause(): Promise<void>
  togglePlay(): Promise<void>
  activateElement(): Promise<void>
  addListener(event: "ready" | "not_ready", cb: (e: { device_id: string }) => void): void
  addListener(event: "player_state_changed", cb: (state: { paused: boolean } | null) => void): void
  addListener(
    event: "initialization_error" | "authentication_error" | "account_error",
    cb: (e: { message: string }) => void,
  ): void
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void
    Spotify?: {
      Player: new (options: {
        name: string
        getOAuthToken: (cb: (token: string) => void) => void
        volume?: number
      }) => SdkPlayer
    }
  }
}

export class SpotifyConnectError extends Error {}

let device: Promise<{ player: SdkPlayer; deviceId: string }> | null = null

function loadSdk(): Promise<void> {
  if (window.Spotify) return Promise.resolve()
  return new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve()
    const script = document.createElement("script")
    script.src = SDK_SRC
    script.async = true
    script.onerror = () => reject(new SpotifyConnectError("Spotify's player didn't load."))
    document.body.appendChild(script)
  })
}

/** The in-tab Spotify device, created once per page. */
function getDevice() {
  device ??= loadSdk().then(
    () =>
      new Promise<{ player: SdkPlayer; deviceId: string }>((resolve, reject) => {
        const Player = window.Spotify?.Player
        if (!Player) return reject(new SpotifyConnectError("Spotify's player didn't load."))
        const player = new Player({
          name: "subcult",
          volume: 0.8,
          getOAuthToken: (cb) => void getAccessToken().then((token) => token && cb(token)),
        })
        const fail = ({ message }: { message: string }) => {
          device = null
          reject(new SpotifyConnectError(message))
        }
        player.addListener("account_error", () =>
          fail({ message: "Full songs need Spotify Premium." }),
        )
        player.addListener("authentication_error", fail)
        player.addListener("initialization_error", fail)
        player.addListener("ready", ({ device_id }) => resolve({ player, deviceId: device_id }))
        let paused = true
        player.addListener("player_state_changed", (state) => {
          const nowPaused = state?.paused ?? true
          if (paused && !nowPaused) externalPlaybackStarted("spotify-sdk")
          paused = nowPaused
        })
        registerExternalPlayer("spotify-sdk", { pause: () => void player.pause() })
        void player.connect()
      }),
  )
  return device
}

async function api(path: string, init: RequestInit): Promise<void> {
  const token = await getAccessToken()
  if (!token) throw new SpotifyConnectError("Connect Spotify first.")
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  })
  if (response.status === 403) {
    throw new SpotifyConnectError(
      "Spotify said no: this account may not be on the app's 5-user allowlist, or isn't Premium.",
    )
  }
  if (!response.ok) throw new SpotifyConnectError(`Spotify error ${response.status}`)
}

/** Play a full track in this tab. Call from a tap (iOS needs activateElement in a gesture). */
export async function playFullTrack(uri: string): Promise<void> {
  const pending = getDevice()
  const { player, deviceId } = await pending
  await player.activateElement()
  await api(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: "PUT",
    body: JSON.stringify({ uris: [uri] }),
  })
}

export async function toggleFullTrack(): Promise<void> {
  const { player } = await getDevice()
  await player.togglePlay()
}

/** "Save to Spotify": PUT /me/library (Feb 2026 replacement for PUT /me/tracks). */
export async function saveToLibrary(uri: string): Promise<void> {
  await api(`/me/library?uris=${encodeURIComponent(uri)}`, { method: "PUT" })
}
