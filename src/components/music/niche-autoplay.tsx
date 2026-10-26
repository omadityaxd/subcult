"use client"

import { Play } from "lucide-react"
import { useEffect, useState } from "react"
import {
  autoplayEnabled,
  hasUserActivation,
  isSoundtrackLoaded,
  playSoundtrack,
} from "@/lib/audio/player"
import { isAnythingPlaying } from "@/lib/audio/handoff"
import { getAudioEngine, useAudioState } from "@/lib/audio/use-audio"
import type { Soundtrack } from "@/lib/music/soundtrack"

/** How long to wait for autoplay to actually start before offering the pill. */
const AUTOPLAY_GRACE_MS = 1500

/**
 * Opt-in only (Me → Settings, off by default): with the setting on, opening a
 * niche starts its soundtrack when the browser allows sound; if the browser
 * refuses, a "tap to play the vibe" pill offers it instead. With the setting
 * off, nothing plays and nothing is offered: music waits to be asked for.
 */
export function NicheAutoplay({ soundtrack }: { soundtrack: Soundtrack }) {
  const state = useAudioState()
  const [offer, setOffer] = useState(false)
  const loaded = state.owner === "player" && state.queue[0]?.niche === soundtrack.slug

  useEffect(() => {
    if (soundtrack.tracks.length === 0 || isSoundtrackLoaded(soundtrack.slug)) return
    const engine = getAudioEngine()
    if (!autoplayEnabled()) return
    // Never interrupt something chosen: a loaded track (playing or paused), a story,
    // a preview or an embed. Autoplay only fills silence.
    if (engine.getState().track || isAnythingPlaying()) return
    const tryAutoplay = hasUserActivation()
    if (tryAutoplay) playSoundtrack(soundtrack, 0)
    const timer = setTimeout(
      () => {
        const now = engine.getState()
        const started =
          now.owner === "player" && now.playing && now.queue[0]?.niche === soundtrack.slug
        if (!started) setOffer(true)
      },
      tryAutoplay ? AUTOPLAY_GRACE_MS : 0,
    )
    return () => clearTimeout(timer)
  }, [soundtrack])

  if (!offer || loaded || soundtrack.tracks.length === 0) return null

  return (
    <button
      type="button"
      onClick={() => {
        playSoundtrack(soundtrack, 0)
        setOffer(false)
      }}
      className="fixed bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom)+0.75rem+var(--footer-space,0px)+var(--player-space,0px))] left-1/2 z-(--z-float) inline-flex h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-niche px-5 text-callout font-semibold whitespace-nowrap text-niche-foreground shadow-pop transition-transform active:scale-95 md:bottom-[calc(1.5rem+var(--footer-space,0px)+var(--player-space,0px))] md:left-[calc(50%+var(--rail-width)/2)] xl:left-[calc(50%+var(--sidebar-width)/2)]"
    >
      <Play aria-hidden className="size-4" fill="currentColor" strokeWidth={0} />
      Tap to play the vibe
    </button>
  )
}
