"use client"

/**
 * YouTube IFrame Player API (https://developers.google.com/youtube/iframe_api_reference),
 * loaded once. Official embeds only: we never draw over the player, and the
 * Required Minimum Functionality rules (≥200×200 viewport, autoplay only when
 * more than half visible, one autoplaying player at a time) are enforced by
 * the components that use it.
 */
const API_SRC = "https://www.youtube.com/iframe_api"

export const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2 } as const

export interface YtPlayer {
  playVideo(): void
  pauseVideo(): void
  mute(): void
  unMute(): void
  isMuted(): boolean
  getPlayerState(): number
  destroy(): void
}

export interface YtPlayerOptions {
  videoId: string
  width?: string | number
  height?: string | number
  host?: string
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: (event: { target: YtPlayer }) => void
    onStateChange?: (event: { data: number; target: YtPlayer }) => void
    onError?: (event: { data: number }) => void
  }
}

declare global {
  interface Window {
    YT?: { Player: new (element: HTMLElement, options: YtPlayerOptions) => YtPlayer }
    onYouTubeIframeAPIReady?: () => void
  }
}

let ready: Promise<void> | null = null

export function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  ready ??= new Promise<void>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve()
    }
    const script = document.createElement("script")
    script.src = API_SRC
    script.async = true
    script.onerror = () => {
      ready = null
      reject(new Error("YouTube player failed to load"))
    }
    document.body.appendChild(script)
  })
  return ready
}

/** Creates a player inside `container` on a child element React doesn't own. */
export async function createYouTubePlayer(
  container: HTMLElement,
  options: YtPlayerOptions,
): Promise<YtPlayer> {
  await loadYouTubeApi()
  const Player = window.YT?.Player
  if (!Player) throw new Error("YouTube player failed to load")
  const target = document.createElement("div")
  container.replaceChildren(target)
  return new Player(target, {
    width: "100%",
    height: "100%",
    host: "https://www.youtube-nocookie.com",
    ...options,
  })
}

// Pure, so server code imports it from youtube-id directly; re-exported for the players.
export { youtubeIdOf } from "./youtube-id"
