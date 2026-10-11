"use client"

import { ChevronDown, ChevronUp, Volume2, VolumeX, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { MediaImage } from "@/components/ds/media-image"
import { SaveButton } from "@/components/ds/save-button"
import { externalPlaybackStarted, registerExternalPlayer } from "@/lib/audio/handoff"
import { decodeRelatedNiches } from "@/lib/feed/related-niches"
import type { FeedItem } from "@/lib/feed/types"
import { type ReelsState, closeReels, useReels } from "@/lib/video/reels-store"
import { YT_STATE, type YtPlayer, createYouTubePlayer, youtubeIdOf } from "@/lib/video/youtube-api"

/** Mounted once in the tabs layout; renders when a video card opens it. */
export function ReelsHost() {
  const reels = useReels()
  return reels ? <ReelsViewer key={`${reels.items[0]?.id}:${reels.index}`} reels={reels} /> : null
}

/**
 * Full-screen, swipe-up/down video viewer. Only the slide in view has a
 * player (one playing YouTube player at a time); controls live outside the
 * player frame. Sound on pauses the music.
 */
function ReelsViewer({ reels }: { reels: ReelsState }) {
  const scroller = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(reels.index)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    const element = scroller.current
    if (element) element.scrollTop = reels.index * element.clientHeight
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [reels.index])

  const go = (next: number) => {
    const element = scroller.current
    if (!element) return
    const clamped = Math.max(0, Math.min(reels.items.length - 1, next))
    element.scrollTo({ top: clamped * element.clientHeight, behavior: "smooth" })
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeReels()
      if (event.key === "ArrowDown" || event.key === "j") go(index + 1)
      if (event.key === "ArrowUp" || event.key === "k") go(index - 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Videos"
      className="fixed inset-0 z-[80] bg-black text-white"
    >
      <div
        ref={scroller}
        onScroll={(event) => {
          const element = event.currentTarget
          setIndex(Math.round(element.scrollTop / Math.max(1, element.clientHeight)))
        }}
        className="no-scrollbar h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
      >
        {reels.items.map((item, i) => (
          <Slide
            key={item.id}
            item={item}
            active={i === index}
            muted={muted}
            onToggleMute={() => setMuted((value) => !value)}
          />
        ))}
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <button
          type="button"
          onClick={closeReels}
          aria-label="Close videos"
          className="pointer-events-auto grid size-10 place-items-center rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20"
        >
          <X aria-hidden className="size-5" strokeWidth={1.75} />
        </button>
        <span className="text-footnote text-white/70 tabular-nums">
          {index + 1} / {reels.items.length}
        </span>
      </header>

      <nav
        aria-label="Video navigation"
        className="absolute top-1/2 right-4 hidden -translate-y-1/2 flex-col gap-2 md:flex"
      >
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="Previous video"
          className="grid size-11 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"
        >
          <ChevronUp aria-hidden className="size-5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={index >= reels.items.length - 1}
          aria-label="Next video"
          className="grid size-11 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"
        >
          <ChevronDown aria-hidden className="size-5" strokeWidth={1.75} />
        </button>
      </nav>
    </div>,
    document.body,
  )
}

function Slide({
  item,
  active,
  muted,
  onToggleMute,
}: {
  item: FeedItem
  active: boolean
  muted: boolean
  onToggleMute: () => void
}) {
  const videoId = youtubeIdOf(item)
  const related = decodeRelatedNiches(item.meta.niches)
  return (
    <section
      aria-label={item.title}
      className="flex h-full snap-start snap-always flex-col justify-center gap-5 px-4 pt-16 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] md:px-24"
    >
      <div className="relative mx-auto aspect-video max-h-[60dvh] min-h-[200px] w-full max-w-4xl bg-black">
        {active && videoId ? (
          <ReelPlayer videoId={videoId} muted={muted} />
        ) : item.imageUrl ? (
          <MediaImage src={item.imageUrl} alt="" sizes="100vw" />
        ) : null}
      </div>
      <div className="mx-auto flex w-full max-w-4xl items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-headline font-semibold">{item.title}</p>
          <p className="mt-0.5 truncate text-footnote text-white/65">{item.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onToggleMute}
          aria-pressed={!muted}
          aria-label={muted ? "Turn sound on" : "Mute"}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20"
        >
          {muted ? (
            <VolumeX aria-hidden className="size-5" strokeWidth={1.75} />
          ) : (
            <Volume2 aria-hidden className="size-5" strokeWidth={1.75} />
          )}
        </button>
        <SaveButton
          tone="overlay"
          item={{
            id: item.id,
            title: item.title,
            url: item.url,
            imageUrl: item.imageUrl,
            source: item.source,
            subtitle: item.subtitle,
          }}
        />
      </div>
      {related.length > 0 ? (
        <ul className="mx-auto flex w-full max-w-4xl flex-wrap gap-2">
          {related.map((niche) => (
            <li key={niche.slug}>
              <Link
                href={`/n/${niche.slug}`}
                onClick={closeReels}
                className="inline-flex h-8 items-center rounded-full border border-white/25 px-3 text-footnote font-medium hover:bg-white/10"
              >
                {niche.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

/** The active slide's player: autoplays (opened by a tap), sound per the viewer's mute toggle. */
function ReelPlayer({ videoId, muted }: { videoId: string; muted: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  const player = useRef<YtPlayer | null>(null)
  const mutedRef = useRef(muted)
  const id = useId()

  useEffect(() => {
    const container = host.current
    if (!container) return
    let disposed = false
    let unregister = () => {}
    createYouTubePlayer(container, {
      videoId,
      playerVars: { autoplay: 1, controls: 1, playsinline: 1, rel: 0 },
      events: {
        onReady: ({ target }) => {
          if (disposed) return target.destroy()
          player.current = target
          if (mutedRef.current) target.mute()
          else target.unMute()
          target.playVideo()
          unregister = registerExternalPlayer(id, { pause: () => target.pauseVideo() })
        },
        onStateChange: ({ data, target }) => {
          if (data === YT_STATE.PLAYING && !target.isMuted()) externalPlaybackStarted(id)
        },
      },
    }).catch(() => undefined)
    return () => {
      disposed = true
      unregister()
      player.current?.destroy()
      player.current = null
      container.replaceChildren()
    }
  }, [videoId, id])

  useEffect(() => {
    mutedRef.current = muted
    const current = player.current
    if (!current) return
    if (muted) current.mute()
    else {
      current.unMute()
      externalPlaybackStarted(id)
    }
  }, [muted, id])

  return <div ref={host} className="absolute inset-0" />
}
