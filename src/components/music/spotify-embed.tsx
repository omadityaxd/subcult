"use client"

import { useEffect, useId, useRef, useState } from "react"
import { externalPlaybackStarted, registerExternalPlayer } from "@/lib/audio/handoff"
import {
  type EmbedController,
  type PlaybackUpdate,
  loadSpotifyIframeApi,
} from "@/lib/audio/spotify-embed"
import { cn } from "@/lib/utils"

/**
 * Spotify's official embed, hosted in our UI. It plays whatever Spotify lets
 * this listener hear (full track when logged in with Premium on desktop, a
 * 30s preview otherwise), and hands audio off with our own player.
 */
export function SpotifyEmbed({
  uri,
  height = 152,
  autoPlay = false,
  onController,
  onUpdate,
  className,
}: {
  uri: string
  height?: number
  autoPlay?: boolean
  onController?: (controller: EmbedController | null) => void
  onUpdate?: (update: PlaybackUpdate) => void
  className?: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const id = useId()
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading")
  // Latest callbacks without re-creating the embed when the parent re-renders.
  const callbacks = useRef({ onController, onUpdate })
  useEffect(() => {
    callbacks.current = { onController, onUpdate }
  })

  useEffect(() => {
    const container = host.current
    if (!container) return
    let controller: EmbedController | null = null
    let unregister = () => {}
    let disposed = false
    // The API replaces the element it's given: hand it a child React doesn't own.
    const target = document.createElement("div")
    container.appendChild(target)

    loadSpotifyIframeApi()
      .then((api) => {
        if (disposed) return
        api.createController(target, { uri, width: "100%", height }, (created) => {
          if (disposed) {
            created.destroy()
            return
          }
          controller = created
          unregister = registerExternalPlayer(id, { pause: () => created.pause() })
          callbacks.current.onController?.(created)
          let paused = true
          created.addListener("ready", () => {
            setStatus("ready")
            if (autoPlay) created.play()
          })
          created.addListener("playback_update", ({ data }) => {
            if (paused && !data.isPaused) externalPlaybackStarted(id)
            paused = data.isPaused
            callbacks.current.onUpdate?.(data)
          })
        })
      })
      .catch(() => {
        if (!disposed) setStatus("failed")
      })

    return () => {
      disposed = true
      unregister()
      callbacks.current.onController?.(null)
      controller?.destroy()
      container.replaceChildren()
    }
  }, [uri, height, autoPlay, id])

  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)} style={{ height }}>
      <div ref={host} className="size-full" />
      {status === "loading" ? (
        <div aria-hidden className="absolute inset-0 animate-pulse rounded-xl bg-white/10" />
      ) : null}
      {status === "failed" ? (
        <p className="absolute inset-0 grid place-items-center text-footnote text-muted-foreground">
          Spotify&apos;s player didn&apos;t load (a blocker may be on).
        </p>
      ) : null}
    </div>
  )
}
