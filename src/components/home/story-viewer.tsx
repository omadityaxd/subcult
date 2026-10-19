"use client"

import { ArrowUpRight, Volume2, VolumeX, X } from "lucide-react"
import { motion, type PanInfo, useReducedMotion } from "motion/react"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Cover } from "@/components/ds/cover"
import { MediaImage } from "@/components/ds/media-image"
import { NicheAvatar } from "@/components/ds/niche-avatar"
import { getAudioEngine, useAudioState } from "@/lib/audio/use-audio"
import { STORY_ITEM_MS, gestures, springs } from "@/lib/design/tokens"
import type { HomeNiche } from "@/lib/feed/featured"
import type { FeedItem } from "@/lib/feed/types"
import { youtubeCrop } from "@/lib/images/youtube-crop"
import type { ApiResponse } from "@/lib/request"
import { cn } from "@/lib/utils"
import { MusicSticker } from "./music-sticker"
import { useStoryMusic } from "./use-story-music"
import { CopOrDrop } from "@/components/votes/cop-or-drop"
import { PollFrame } from "@/components/votes/poll-frame"

const OPEN_LABEL: Record<FeedItem["source"], string> = {
  spotify: "Listen on Spotify",
  youtube: "Watch on YouTube",
  news: "Read the story",
  arena: "Open on Are.na",
  unsplash: "View on Unsplash",
  pexels: "View on Pexels",
  ebay: "Buy on eBay",
  subcult: "Open",
}

interface StoryViewerProps {
  niches: readonly HomeNiche[]
  startIndex: number
  onSeen: (slug: string) => void
  onClose: () => void
}

/**
 * Full-screen stories: tap right/left for next/previous, hold to pause,
 * swipe down (or Esc) to close. Each frame links out to its source.
 */
export function StoryViewer({ niches, startIndex, onSeen, onClose }: StoryViewerProps) {
  const [nicheIndex, setNicheIndex] = useState(startIndex)
  const [frame, setFrame] = useState(0)
  const [items, setItems] = useState<Record<string, FeedItem[]>>({})
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const progressRef = useRef(0)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const reduceMotion = useReducedMotion()

  const niche = niches[nicheIndex]
  const frames = items[niche.slug]
  const current = frames?.[frame]
  const music = useStoryMusic(niche.slug, paused)
  const audio = useAudioState()

  // Load (and remember) the current niche's frames.
  useEffect(() => {
    if (items[niche.slug]) return
    let cancelled = false
    fetch(`/api/feed?niche=${niche.slug}`)
      .then((response) => response.json() as Promise<ApiResponse<{ items: FeedItem[] }>>)
      .then((body) => {
        if (!cancelled)
          setItems((map) => ({ ...map, [niche.slug]: body.success ? body.data.items : [] }))
      })
      .catch(() => {
        if (!cancelled) setItems((map) => ({ ...map, [niche.slug]: [] }))
      })
    return () => {
      cancelled = true
    }
  }, [items, niche.slug])

  useEffect(() => onSeen(niche.slug), [niche.slug, onSeen])

  const next = useCallback(() => {
    // Still loading this niche: wait for its frames instead of skipping it.
    if (!frames) return
    progressRef.current = 0
    setProgress(0)
    if (frame < frames.length - 1) setFrame((f) => f + 1)
    else if (nicheIndex < niches.length - 1) {
      setNicheIndex((i) => i + 1)
      setFrame(0)
    } else onClose()
  }, [frame, frames, nicheIndex, niches.length, onClose])

  const previous = useCallback(() => {
    progressRef.current = 0
    setProgress(0)
    if (frame > 0) setFrame((f) => f - 1)
    else if (nicheIndex > 0) {
      setNicheIndex((i) => i - 1)
      setFrame(0)
    }
  }, [frame, nicheIndex])

  // Frame timer (rAF so it pauses cleanly and stays smooth). Progress lives in
  // a ref and next() runs from the loop, never inside a state updater, which
  // React may call twice (that used to skip a whole niche).
  useEffect(() => {
    if (!frames || frames.length === 0 || paused) return
    let raf = 0
    let last = performance.now()
    const tick = (time: number) => {
      progressRef.current += (time - last) / STORY_ITEM_MS
      last = time
      if (progressRef.current >= 1) {
        next()
        return
      }
      setProgress(progressRef.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [frames, paused, next])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
      if (event.key === "ArrowRight") next()
      if (event.key === "ArrowLeft") previous()
      if (event.key === " ") {
        event.preventDefault()
        setPaused((value) => !value)
      }
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [next, previous, onClose])

  const onPointerDown = () => {
    held.current = false
    holdTimer.current = setTimeout(() => {
      held.current = true
      setPaused(true)
    }, 200)
  }
  const onPointerUp = (side: "left" | "right") => {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    if (held.current) {
      setPaused(false)
      return
    }
    if (side === "left") previous()
    else next()
  }
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > gestures.dismissPx) onClose()
  }

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`${niche.name} story`}
      className="fixed inset-0 z-[60] bg-black text-white"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springs.gentle}
    >
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={onDragEnd}
        className="relative mx-auto flex h-full w-full max-w-[min(100vw,30rem)] flex-col overflow-hidden md:my-6 md:h-[calc(100%-3rem)] md:rounded-3xl"
      >
        <Cover palette={niche.palette} seed={niche.slug} className="absolute inset-0" />
        {current?.imageUrl ? (
          <div className="absolute inset-0 scale-110 opacity-60 blur-3xl">
            <MediaImage src={current.imageUrl} alt="" sizes="480px" />
          </div>
        ) : null}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70"
        />

        {/* progress */}
        <div className="relative z-10 flex gap-1 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          {(frames ?? [null]).map((_, index) => (
            <span key={index} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <span
                className="block h-full bg-white"
                style={{ width: `${index < frame ? 100 : index === frame ? progress * 100 : 0}%` }}
              />
            </span>
          ))}
        </div>

        <header className="relative z-10 flex items-center gap-3 px-4 pt-3">
          <Link
            href={`/n/${niche.slug}`}
            onClick={onClose}
            className="flex min-w-0 flex-1 items-center gap-2.5"
          >
            <NicheAvatar
              slug={niche.slug}
              name={niche.name}
              palette={niche.palette}
              imageUrl={niche.imageUrl}
              size="sm"
            />
            <span className="truncate font-serif text-title-3 italic">{niche.name}</span>
          </Link>
          {music ? (
            <button
              type="button"
              onClick={() => getAudioEngine().setMuted(!audio.muted)}
              aria-label={audio.muted ? "Unmute" : "Mute"}
              aria-pressed={audio.muted}
              className="grid size-10 place-items-center rounded-full hover:bg-white/10"
            >
              {audio.muted ? (
                <VolumeX aria-hidden className="size-5" strokeWidth={1.5} />
              ) : (
                <Volume2 aria-hidden className="size-5" strokeWidth={1.5} />
              )}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close stories"
            className="grid size-10 place-items-center rounded-full hover:bg-white/10"
          >
            <X aria-hidden className="size-6" strokeWidth={1.5} />
          </button>
        </header>

        {/* frame */}
        <div className="relative z-10 flex flex-1 flex-col justify-center px-6">
          {!frames ? (
            <div className="mx-auto aspect-square w-full max-w-sm animate-pulse rounded-3xl bg-white/10" />
          ) : !current ? (
            <p className="text-center font-serif text-title-2 italic">Nothing new here yet.</p>
          ) : current.meta.poll === true ? (
            <PollFrame item={current} />
          ) : current.imageUrl ? (
            <div>
              <div
                className={cn(
                  "relative mx-auto w-full max-w-sm overflow-hidden rounded-3xl shadow-pop",
                  current.type === "video" ? "aspect-video" : "aspect-square",
                )}
              >
                <MediaImage
                  key={current.id}
                  src={current.imageUrl}
                  alt=""
                  sizes="384px"
                  priority
                  className={youtubeCrop(current.imageUrl, {
                    short: current.meta.short === true,
                    frame: current.type === "video" ? "landscape" : "portrait",
                  })}
                />
              </div>
              <p className="mx-auto mt-6 max-w-sm text-title-3 font-semibold text-balance">
                {current.title}
              </p>
              {current.subtitle ? (
                <p className="mx-auto mt-1 max-w-sm text-callout text-white/70">
                  {current.subtitle}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mx-auto max-w-sm">
              <p className="text-overline font-medium text-white/60 uppercase">
                {current.subtitle ?? "News"}
              </p>
              <p className="mt-3 font-serif text-title-1 text-balance italic">{current.title}</p>
            </div>
          )}
        </div>

        {/* tap zones (below header, above CTA) */}
        <div className="absolute inset-x-0 top-28 bottom-28 z-20 flex">
          <button
            type="button"
            aria-label="Previous"
            className="h-full w-1/3"
            onPointerDown={onPointerDown}
            onPointerUp={() => onPointerUp("left")}
          />
          <button
            type="button"
            aria-label="Next"
            className="h-full flex-1"
            onPointerDown={onPointerDown}
            onPointerUp={() => onPointerUp("right")}
          />
        </div>

        {current && current.meta.poll !== true ? (
          <div className="relative z-30 space-y-3 px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
            {music ? <MusicSticker music={music} playing={audio.playing && !audio.muted} /> : null}
            <CopOrDrop key={current.id} item={current} tone="overlay" />
            <a
              href={current.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-callout font-semibold text-black active:scale-[0.98]"
            >
              {OPEN_LABEL[current.source]}
              <ArrowUpRight aria-hidden className="size-4" strokeWidth={1.75} />
            </a>
          </div>
        ) : null}
      </motion.div>
    </motion.div>,
    document.body,
  )
}
