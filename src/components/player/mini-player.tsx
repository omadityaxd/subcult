"use client"

import { ChevronUp, Pause, Play, SkipBack, SkipForward } from "lucide-react"
import Image from "next/image"
import { useEffect, useState } from "react"
import { useArtworkColor } from "@/lib/audio/artwork-color"
import { usePlayerEngaged } from "@/lib/audio/player"
import { getAudioEngine, useAudioState } from "@/lib/audio/use-audio"
import { cn } from "@/lib/utils"
import { useKeyboardOpen } from "@/lib/ui/keyboard"
import { useAnyOverlayOpen } from "@/lib/ui/overlays"
import { NowPlaying } from "./now-playing"
import { SpotifyFallbackSheet } from "./spotify-fallback-sheet"
import { ProgressBar } from "./progress-bar"

const COLLAPSE_AFTER_PX = 160
const SCROLL_JITTER_PX = 8
/** Matches the md breakpoint where the player docks in its own bar. */
const DOCKED_QUERY = "(min-width: 768px)"

/**
 * Phones: collapsed while scrolling down the page, open again on the way up
 * (or at the top). Docked on desktop it covers nothing, so it stays open.
 */
function useCollapsedOnScroll(): boolean {
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    let last = window.scrollY
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const y = window.scrollY
        if (Math.abs(y - last) < SCROLL_JITTER_PX) return
        const docked = window.matchMedia(DOCKED_QUERY).matches
        setCollapsed(!docked && y > last && y > COLLAPSE_AFTER_PX)
        last = y
      })
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
    }
  }, [])
  return collapsed
}

/**
 * The persistent player: a small floating pill that only appears once the
 * listener has actually played something (music is the soundtrack, not the
 * show). It shrinks to its artwork while you scroll down and comes back on
 * the way up. Tap it for Now Playing. Lives in the tabs layout, so the audio
 * survives navigation.
 */
export function MiniPlayer() {
  const state = useAudioState()
  const engaged = usePlayerEngaged()
  const collapsed = useCollapsedOnScroll()
  const [open, setOpen] = useState(false)
  const track = state.owner === "player" && engaged ? state.track : null
  // Out of the way (still playing) while a sheet, dialog, story, Reels or the keyboard is up.
  const overlayOpen = useAnyOverlayOpen()
  const keyboardOpen = useKeyboardOpen()
  const hidden = overlayOpen || keyboardOpen
  const accent = useArtworkColor(track?.artworkUrl)

  // Reserve the player's room so it never covers the end of a page (or, docked on desktop,
  // anything at all): --player-space is read by page padding and sticky rails.
  useEffect(() => {
    const root = document.documentElement
    if (track) root.style.setProperty("--player-space", "var(--player-dock)")
    else root.style.removeProperty("--player-space")
  }, [track])

  // First tap anywhere unlocks audio, so a later intentional play works on iOS.
  useEffect(() => {
    const unlock = () => getAudioEngine().unlock()
    const options = { once: true, capture: true } as const
    window.addEventListener("pointerdown", unlock, options)
    window.addEventListener("keydown", unlock, options)
    return () => {
      window.removeEventListener("pointerdown", unlock, options)
      window.removeEventListener("keydown", unlock, options)
    }
  }, [])

  if (!track) return null
  const engine = getAudioEngine()
  const artwork = (size: string) => (
    <span className={cn("relative shrink-0 overflow-hidden rounded-full bg-white/10", size)}>
      {track.artworkUrl ? (
        <Image
          src={track.artworkUrl}
          alt=""
          fill
          sizes="44px"
          unoptimized
          className="object-cover"
        />
      ) : null}
    </span>
  )

  return (
    <>
      <div
        className={cn(
          "pointer-events-none fixed inset-x-3 bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom)+var(--footer-space,0px)+0.5rem)] z-(--z-player) flex justify-end",
          // Desktop: docked in its own bar along the content column (the page reserves its
          // height, --player-space), so it never floats over text or the right rail.
          "transition-[opacity,translate] duration-200",
          hidden && "invisible translate-y-4 opacity-0",
          "md:inset-x-auto md:right-0 md:bottom-(--footer-space) md:left-(--rail-width) md:h-(--player-dock) md:items-center md:border-t md:border-border md:bg-background/90 md:px-6 md:backdrop-blur-xl xl:left-(--sidebar-width)",
        )}
        style={{ "--accent": accent } as React.CSSProperties}
        aria-hidden={hidden || undefined}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`Now playing: ${track.title} by ${track.artist}. Open player`}
            className="pointer-events-auto relative grid size-12 place-items-center rounded-full bg-[color-mix(in_srgb,var(--accent)_35%,#0b0b0b)] p-1 shadow-pop ring-1 ring-white/10 transition-transform active:scale-95"
          >
            {artwork("size-10")}
            {state.playing ? (
              <span
                aria-hidden
                className="absolute inset-0 animate-pulse rounded-full ring-2 ring-[var(--accent)]"
              />
            ) : null}
          </button>
        ) : (
          <div className="pointer-events-auto relative w-full max-w-[17rem] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--accent)_30%,#0b0b0b)] text-white shadow-pop ring-1 ring-white/10 backdrop-blur-xl md:max-w-[22rem]">
            <div className="flex h-12 items-center gap-2 pr-1.5 pl-1.5">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                aria-label={`Now playing: ${track.title} by ${track.artist}. Open player`}
              >
                {artwork("size-9")}
                <span className="min-w-0">
                  <span className="block truncate text-footnote font-semibold">{track.title}</span>
                  <span className="block truncate text-caption text-white/65">{track.artist}</span>
                </span>
              </button>
              <span className="hidden md:inline-flex">
                <IconButton label="Previous" onClick={() => engine.previous()}>
                  <SkipBack aria-hidden className="size-4" strokeWidth={1.75} />
                </IconButton>
              </span>
              <PlayPause playing={state.playing} onClick={() => engine.toggle()} compact />
              <IconButton
                label="Next"
                onClick={() => engine.next()}
                disabled={state.index >= state.queue.length - 1}
              >
                <SkipForward aria-hidden className="size-4" strokeWidth={1.75} />
              </IconButton>
              <span className="hidden md:inline-flex">
                <IconButton label="Open Now Playing" onClick={() => setOpen(true)}>
                  <ChevronUp aria-hidden className="size-4" strokeWidth={1.75} />
                </IconButton>
              </span>
            </div>
            <ProgressBar variant="line" accent={accent} className="absolute inset-x-5 bottom-0.5" />
          </div>
        )}
      </div>
      {open ? <NowPlaying accent={accent} onClose={() => setOpen(false)} /> : null}
      <SpotifyFallbackSheet />
    </>
  )
}

function IconButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-10 place-items-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
    >
      {children}
    </button>
  )
}

export function PlayPause({
  playing,
  onClick,
  compact,
  large,
}: {
  playing: boolean
  onClick: () => void
  compact?: boolean
  large?: boolean
}) {
  const size = large ? "size-16" : compact ? "size-10" : "size-9"
  const icon = large ? "size-7" : "size-[18px]"
  return (
    <button
      type="button"
      aria-label={playing ? "Pause" : "Play"}
      onClick={onClick}
      className={`grid ${size} place-items-center rounded-full ${compact ? "text-white" : "bg-white text-black"} transition-transform active:scale-95`}
    >
      {playing ? (
        <Pause aria-hidden className={icon} fill="currentColor" strokeWidth={0} />
      ) : (
        <Play
          aria-hidden
          className={`${icon} translate-x-px`}
          fill="currentColor"
          strokeWidth={0}
        />
      )}
    </button>
  )
}
