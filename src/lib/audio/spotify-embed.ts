"use client"

/**
 * Spotify Embed iFrame API (https://developer.spotify.com/documentation/embeds/references/iframe-api).
 * What it plays depends on the listener, not on us: logged-out visitors (and
 * most mobile browsers) get 30s previews; a Premium account logged in to
 * spotify.com in a desktop browser gets the full track.
 */
export const SPOTIFY_IFRAME_API = "https://open.spotify.com/embed/iframe-api/v1"

export interface PlaybackUpdate {
  playingURI: string
  isPaused: boolean
  isBuffering: boolean
  /** Milliseconds. */
  duration: number
  position: number
}

export interface EmbedController {
  loadUri(uri: string): void
  play(): void
  pause(): void
  resume(): void
  togglePlay(): void
  seek(seconds: number): void
  destroy(): void
  addListener(event: "ready", listener: () => void): void
  addListener(event: "playback_update", listener: (e: { data: PlaybackUpdate }) => void): void
}

export interface IFrameApi {
  createController(
    element: HTMLElement,
    options: { uri: string; width?: number | string; height?: number | string },
    callback: (controller: EmbedController) => void,
  ): void
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: IFrameApi) => void
  }
}

let api: Promise<IFrameApi> | null = null

/** Loads the iFrame API script once; resolves when Spotify calls back. */
export function loadSpotifyIframeApi(): Promise<IFrameApi> {
  api ??= new Promise<IFrameApi>((resolve, reject) => {
    window.onSpotifyIframeApiReady = resolve
    const script = document.createElement("script")
    script.src = SPOTIFY_IFRAME_API
    script.async = true
    script.onerror = () => {
      api = null
      reject(new Error("Spotify embed failed to load"))
    }
    document.body.appendChild(script)
  })
  return api
}

const SPOTIFY_URL =
  /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|artist|episode)\/([A-Za-z0-9]{22})/

/** "https://open.spotify.com/track/abc…" → "spotify:track:abc…"; search links → null. */
export function spotifyUriFrom(url: string | null | undefined): string | null {
  const match = url?.match(SPOTIFY_URL)
  return match ? `spotify:${match[1]}:${match[2]}` : null
}
