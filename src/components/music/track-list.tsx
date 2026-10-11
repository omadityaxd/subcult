"use client"

import { Loader2, Pause, Play } from "lucide-react"
import Image from "next/image"
import { useMemo } from "react"
import type { PlayableTrack } from "@/lib/audio/play-tracks"
import { playSoundtrack } from "@/lib/audio/player"
import { getAudioEngine, useAudioState } from "@/lib/audio/use-audio"
import { type Soundtrack, formatDuration } from "@/lib/music/soundtrack"
import { cn } from "@/lib/utils"
import { SpotifyLink } from "./spotify-link"
import { useTrackPlayer } from "./use-track-player"

/** A niche soundtrack as a playable list. */
export function TrackList({ soundtrack }: { soundtrack: Soundtrack }) {
  const tracks = useMemo(() => soundtrackTracks(soundtrack), [soundtrack])
  return <PlayableList tracks={tracks} context={soundtrack.title} showDuration />
}

export function soundtrackTracks(soundtrack: Soundtrack): PlayableTrack[] {
  return soundtrack.tracks.map((track) => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    artworkUrl: track.artworkUrl,
    spotifyUrl: track.spotifyUrl,
    previewUrl: track.previewUrl,
    appleUrl: track.appleUrl,
    niche: soundtrack.slug,
    durationMs: track.durationMs,
  }))
}

/**
 * Numbered list: tap a row to play from there (queue = the whole list),
 * tap the playing row to pause. "Spotify" is a small secondary link.
 */
export function PlayableList({
  tracks,
  context,
  showDuration = false,
  numbered = true,
}: {
  tracks: readonly (PlayableTrack & { durationMs?: number | null })[]
  context: string | null
  showDuration?: boolean
  numbered?: boolean
}) {
  const { play, currentId, playing, pendingId, missing } = useTrackPlayer(tracks, context)

  return (
    <ol className="-mx-2">
      {tracks.map((track, index) => {
        const current = track.id === currentId
        const unavailable = missing.has(track.id)
        return (
          <li key={track.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => play(index)}
              aria-current={current ? "true" : undefined}
              aria-label={`${current && playing ? "Pause" : "Play"} ${track.title} by ${track.artist}`}
              className={cn(
                "group grid min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted",
                numbered
                  ? "grid-cols-[1.75rem_2.75rem_minmax(0,1fr)_auto]"
                  : "grid-cols-[2.75rem_minmax(0,1fr)_auto]",
                current && "bg-muted",
              )}
            >
              {numbered ? (
                <span className="grid place-items-center text-footnote text-muted-foreground tabular-nums">
                  {current && playing ? (
                    <Equalizer />
                  ) : (
                    <>
                      <span className="group-hover:hidden">{index + 1}</span>
                      <Play
                        aria-hidden
                        className="hidden size-4 text-foreground group-hover:block"
                        fill="currentColor"
                        strokeWidth={0}
                      />
                    </>
                  )}
                </span>
              ) : null}
              <span className="relative size-11 overflow-hidden rounded-md bg-muted">
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
                {!numbered && current && playing ? (
                  <span className="absolute inset-0 grid place-items-center bg-black/40">
                    <Equalizer />
                  </span>
                ) : null}
              </span>
              <span className="min-w-0">
                <span
                  className={cn("block truncate text-callout font-medium", current && "text-niche")}
                >
                  {track.title}
                </span>
                <span className="block truncate text-footnote text-muted-foreground">
                  {unavailable ? "No preview for this one" : track.artist}
                </span>
              </span>
              <span className="text-footnote text-muted-foreground tabular-nums">
                {pendingId === track.id ? (
                  <Loader2 aria-label="Loading" className="size-4 animate-spin" />
                ) : showDuration ? (
                  formatDuration(track.durationMs ?? null)
                ) : null}
              </span>
            </button>
            {track.spotifyUrl && (unavailable || current) ? (
              <SpotifyLink href={track.spotifyUrl} />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

export function Equalizer() {
  return (
    <span aria-hidden className="flex h-3.5 items-end gap-[2px] text-niche">
      {[0, 1, 2].map((bar) => (
        <span
          key={bar}
          className="eq-bar w-[3px] rounded-full bg-current"
          style={{ animationDelay: `${bar * 160}ms` }}
        />
      ))}
    </span>
  )
}

/** "This is <niche>": art collage, big play button, honest preview note. */
export function SoundtrackHeader({ soundtrack }: { soundtrack: Soundtrack }) {
  const state = useAudioState()
  const loaded = state.owner === "player" && state.queue[0]?.niche === soundtrack.slug
  const playing = loaded && state.playing
  const art = soundtrack.tracks.flatMap((track) => (track.artworkUrl ? [track.artworkUrl] : []))
  const collage = [...new Set(art)].slice(0, 4)

  return (
    <header className="flex flex-col gap-6 sm:flex-row sm:items-end">
      <div className="grid size-40 shrink-0 grid-cols-2 overflow-hidden rounded-2xl bg-muted shadow-card sm:size-48">
        {collage.map((src) => (
          <span key={src} className={cn("relative", collage.length < 4 && "col-span-2 row-span-2")}>
            <Image src={src} alt="" fill sizes="96px" unoptimized className="object-cover" />
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-overline font-medium text-muted-foreground uppercase">Soundtrack</p>
        <h2 className="mt-1 font-serif text-title-1 italic">{soundtrack.title}</h2>
        <p className="mt-1 text-footnote text-muted-foreground">
          {soundtrack.tracks.length} songs · 30s previews · full songs on Spotify
        </p>
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => (loaded ? getAudioEngine().toggle() : playSoundtrack(soundtrack, 0))}
            aria-label={playing ? "Pause soundtrack" : "Play soundtrack"}
            className="grid size-14 place-items-center rounded-full bg-niche text-niche-foreground shadow-pop transition-transform hover:scale-105 active:scale-95"
          >
            {playing ? (
              <Pause aria-hidden className="size-6" fill="currentColor" strokeWidth={0} />
            ) : (
              <Play
                aria-hidden
                className="size-6 translate-x-0.5"
                fill="currentColor"
                strokeWidth={0}
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              const order = soundtrack.tracks.map((_, i) => i).sort(() => Math.random() - 0.5)
              playSoundtrack({ ...soundtrack, tracks: order.map((i) => soundtrack.tracks[i]) }, 0)
            }}
            className="h-10 rounded-full border border-border-strong px-4 text-footnote font-medium hover:bg-muted"
          >
            Shuffle
          </button>
        </div>
      </div>
    </header>
  )
}
