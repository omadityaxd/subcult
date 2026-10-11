"use client"

import { Play, Volume2, VolumeX } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { MediaImage } from "@/components/ds/media-image"
import { SaveButton } from "@/components/ds/save-button"
import { externalPlaybackStarted, registerExternalPlayer } from "@/lib/audio/handoff"
import type { FeedItem } from "@/lib/feed/types"
import { useAutoplayAllowed, useInlinePreview } from "@/lib/video/inline-preview"
import { openReels, registerVideo, useReels } from "@/lib/video/reels-store"
import { type YtPlayer, createYouTubePlayer, youtubeIdOf } from "@/lib/video/youtube-api"
import { cn } from "@/lib/utils"

const savedShape = (item: FeedItem) => ({
  id: item.id,
  title: item.title,
  url: item.url,
  imageUrl: item.imageUrl,
  source: item.source,
  subtitle: item.subtitle,
})

/**
 * A video in the feed. When it's the most visible card (>60% on screen) a
 * muted preview plays in YouTube's own player and the music keeps going.
 * "Sound on" sits in the footer (never over the player, per YouTube's rules)
 * and pauses the music. The title or the thumbnail opens the full-screen viewer.
 */
export function VideoCard({ item, meta }: { item: FeedItem; meta: string }) {
  const videoId = youtubeIdOf(item)
  const [frame, setFrame] = useState<HTMLDivElement | null>(null)
  const autoplayAllowed = useAutoplayAllowed()
  // One playing YouTube player at a time: previews stop while the viewer is open.
  const viewerOpen = useReels() !== null
  const previewing = useInlinePreview(
    item.id,
    frame,
    autoplayAllowed && !viewerOpen && videoId !== null,
  )
  const host = useRef<HTMLDivElement>(null)
  const { muted, toggleSound } = useInlinePlayer(host, previewing ? videoId : null)
  const articleRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = articleRef.current
    return element ? registerVideo(item, element) : undefined
  }, [item])

  return (
    <article ref={articleRef}>
      {/* YouTube requires a ≥200×200 player viewport; the frame never goes below that. */}
      <div
        ref={setFrame}
        className={cn(
          "relative aspect-video min-h-[200px] w-full overflow-hidden bg-black",
          // Nothing may obscure a live YouTube player, not even rounded-corner clipping.
          previewing ? "rounded-none" : "rounded-2xl",
        )}
      >
        {previewing ? (
          <div ref={host} className="absolute inset-0" />
        ) : (
          <button
            type="button"
            onClick={() => openReels(item)}
            aria-label={`Watch ${item.title}`}
            className="group absolute inset-0"
          >
            {item.imageUrl ? (
              <MediaImage src={item.imageUrl} alt="" sizes="(max-width: 640px) 100vw, 33vw" />
            ) : null}
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-12 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md transition-transform group-active:scale-95">
                <Play
                  aria-hidden
                  className="size-5 translate-x-0.5"
                  fill="currentColor"
                  strokeWidth={0}
                />
              </span>
            </span>
          </button>
        )}
      </div>
      <div className="mt-2.5 flex items-start gap-1.5 px-0.5">
        <button type="button" onClick={() => openReels(item)} className="min-w-0 flex-1 text-left">
          <span className="line-clamp-2 text-headline font-semibold">{item.title}</span>
          <span className="mt-0.5 block truncate text-footnote text-muted-foreground">
            {[item.subtitle, meta].filter(Boolean).join(" · ")}
          </span>
        </button>
        {previewing ? (
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={!muted}
            aria-label={muted ? "Turn sound on" : "Mute video"}
            className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-muted"
          >
            {muted ? (
              <VolumeX aria-hidden className="size-[18px]" strokeWidth={1.75} />
            ) : (
              <Volume2 aria-hidden className="size-[18px] text-niche" strokeWidth={1.75} />
            )}
          </button>
        ) : null}
        <SaveButton item={savedShape(item)} className="size-9 shrink-0" />
      </div>
    </article>
  )
}

/**
 * Mounts a muted, looping YouTube player in `host` while `videoId` is set and
 * tears it down when the card stops being the active preview.
 */
function useInlinePlayer(host: React.RefObject<HTMLDivElement | null>, videoId: string | null) {
  const player = useRef<YtPlayer | null>(null)
  const [muted, setMuted] = useState(true)
  const id = useId()

  useEffect(() => {
    const container = host.current
    if (!container || !videoId) return
    let disposed = false
    let unregister = () => {}
    createYouTubePlayer(container, {
      videoId,
      playerVars: {
        autoplay: 1,
        mute: 1,
        controls: 0,
        playsinline: 1,
        rel: 0,
        loop: 1,
        playlist: videoId,
      },
      events: {
        onReady: ({ target }) => {
          if (disposed) return target.destroy()
          player.current = target
          target.mute()
          target.playVideo()
          // The music taking over again just mutes the preview.
          unregister = registerExternalPlayer(id, {
            pause: () => {
              target.mute()
              setMuted(true)
            },
          })
        },
      },
    }).catch(() => undefined)
    return () => {
      disposed = true
      unregister()
      player.current?.destroy()
      player.current = null
      container.replaceChildren()
      setMuted(true)
    }
  }, [host, videoId, id])

  const toggleSound = () => {
    const current = player.current
    if (!current) return
    if (muted) {
      current.unMute()
      current.playVideo()
      externalPlaybackStarted(id)
    } else {
      current.mute()
    }
    setMuted(!muted)
  }

  return { muted, toggleSound }
}
