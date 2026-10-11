"use client"

import { ChevronUp, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react"
import Image from "next/image"
import { useEffect, useState } from "react"
import { useArtworkColor } from "@/lib/audio/artwork-color"
import { getAudioEngine, useAudioState } from "@/lib/audio/use-audio"
import { NowPlaying } from "./now-playing"
import { ProgressBar } from "./progress-bar"

/**
 * The persistent player. Lives in the tabs layout, so it (and the audio)
 * survives navigation. Phones: a floating card above the tab bar. Tablet and
 * desktop: a bottom bar beside the sidebar. Tap it for Now Playing.
 */
export function MiniPlayer() {
  const state = useAudioState()
  const [open, setOpen] = useState(false)
  const track = state.owner === "player" ? state.track : null
  const accent = useArtworkColor(track?.artworkUrl)

  // Reserve space so the player never covers the end of a page.
  useEffect(() => {
    const root = document.documentElement
    if (track) root.style.setProperty("--player-space", "4.75rem")
    else root.style.removeProperty("--player-space")
  }, [track])

  // First tap anywhere unlocks audio, so later autoplay (in-app navigation) is allowed on iOS.
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

  return (
    <>
      <div
        className="fixed inset-x-2 bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom)+0.5rem)] z-40 md:inset-x-0 md:bottom-0 md:left-(--rail-width) xl:left-(--sidebar-width)"
        style={{ "--accent": accent } as React.CSSProperties}
      >
        <div className="relative overflow-hidden rounded-2xl bg-[color-mix(in_srgb,var(--accent)_32%,#0b0b0b)] text-white shadow-pop backdrop-blur-xl md:rounded-none md:bg-[color-mix(in_srgb,var(--accent)_14%,#0b0b0b)] md:shadow-none md:hairline-t">
          <div className="flex items-center gap-3 p-2 pr-3 md:h-[4.75rem] md:px-5">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left md:max-w-xs"
              aria-label={`Now playing: ${track.title} by ${track.artist}. Open player`}
            >
              <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-white/10 md:size-12">
                {track.artworkUrl ? (
                  <Image
                    src={track.artworkUrl}
                    alt=""
                    fill
                    sizes="48px"
                    unoptimized
                    className="object-cover"
                  />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-callout font-semibold">{track.title}</span>
                <span className="block truncate text-footnote text-white/70">
                  {track.artist}
                  <span className="hidden md:inline"> · preview</span>
                </span>
              </span>
            </button>

            {/* Desktop: full transport + scrubber in the middle */}
            <div className="hidden flex-1 flex-col items-center gap-1.5 md:flex">
              <div className="flex items-center gap-4">
                <IconButton label="Previous" onClick={() => engine.previous()}>
                  <SkipBack aria-hidden className="size-[18px]" strokeWidth={1.75} />
                </IconButton>
                <PlayPause playing={state.playing} onClick={() => engine.toggle()} />
                <IconButton
                  label="Next"
                  onClick={() => engine.next()}
                  disabled={state.index >= state.queue.length - 1}
                >
                  <SkipForward aria-hidden className="size-[18px]" strokeWidth={1.75} />
                </IconButton>
              </div>
              <ProgressBar variant="scrubber" accent={accent} className="w-full max-w-xl" />
            </div>

            <div className="flex items-center gap-1 md:w-xs md:justify-end">
              <span className="md:hidden">
                <PlayPause playing={state.playing} onClick={() => engine.toggle()} compact />
              </span>
              <span className="md:hidden">
                <IconButton
                  label="Next"
                  onClick={() => engine.next()}
                  disabled={state.index >= state.queue.length - 1}
                >
                  <SkipForward aria-hidden className="size-5" strokeWidth={1.75} />
                </IconButton>
              </span>
              <span className="hidden md:inline-flex">
                <IconButton
                  label={state.muted ? "Unmute" : "Mute"}
                  onClick={() => engine.setMuted(!state.muted)}
                >
                  {state.muted ? (
                    <VolumeX aria-hidden className="size-[18px]" strokeWidth={1.75} />
                  ) : (
                    <Volume2 aria-hidden className="size-[18px]" strokeWidth={1.75} />
                  )}
                </IconButton>
              </span>
              <span className="hidden md:inline-flex">
                <IconButton label="Open Now Playing" onClick={() => setOpen(true)}>
                  <ChevronUp aria-hidden className="size-5" strokeWidth={1.75} />
                </IconButton>
              </span>
            </div>
          </div>
          <ProgressBar variant="line" accent={accent} className="mx-2 mb-1 md:hidden" />
        </div>
      </div>
      {open ? <NowPlaying accent={accent} onClose={() => setOpen(false)} /> : null}
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
