"use client"

import { Loader2, Pause, Play } from "lucide-react"
import { CdnImage } from "@/components/ds/cdn-image"
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

/** A row in a playable list: a track plus an optional extra line ("Album · 2d ago"). */
export type ListTrack = PlayableTrack & { durationMs?: number | null; detail?: string | null }

/**
 * The one way tracks are listed: tap a row (or the play button on its art)
 * to play it in the shared player, queue = the whole list; tap the playing
 * row to pause. Previews come from Apple and play here; a song without one
 * opens Spotify's player in-app. Spotify is a small secondary icon.
 */
export function PlayableList({
  tracks,
  context,
  showDuration = false,
  numbered = true,
}: {
  tracks: readonly ListTrack[]
  context: string | null
  showDuration?: boolean
  numbered?: boolean
}) {
  const { play, currentId, playing, pendingId, missing } = useTrackPlayer(tracks, context)

  return (
    <div>
      {/* Bleeds left so art lines up with the text above; the Spotify icon stays inside. */}
      <ol className="-ml-2">
        {tracks.map((track, index) => {
          const current = track.id === currentId
          const unavailable = missing.has(track.id)
          const loading = pendingId === track.id
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
                    ? "grid-cols-[1.25rem_3rem_minmax(0,1fr)_auto]"
                    : "grid-cols-[3rem_minmax(0,1fr)_auto]",
                  current && "bg-muted",
                )}
              >
                {numbered ? (
                  <span className="grid place-items-center text-footnote text-muted-foreground tabular-nums">
                    {current && playing ? <Equalizer /> : index + 1}
                  </span>
                ) : null}
                <span className="relative size-12 overflow-hidden rounded-md bg-muted">
                  {track.artworkUrl ? (
                    <CdnImage
                      src={track.artworkUrl}
                      alt=""
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : null}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-0 grid place-items-center transition-colors",
                      current ? "bg-black/45" : "bg-black/15 group-hover:bg-black/35",
                    )}
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin text-white" />
                    ) : current && playing && !numbered ? (
                      <span className="text-white">
                        <Equalizer />
                      </span>
                    ) : (
                      <span className="grid size-6 place-items-center rounded-full bg-white/90 text-black shadow-sm">
                        {current && playing ? (
                          <Pause className="size-3" fill="currentColor" strokeWidth={0} />
                        ) : (
                          <Play
                            className="size-3 translate-x-px"
                            fill="currentColor"
                            strokeWidth={0}
                          />
                        )}
                      </span>
                    )}
                  </span>
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block truncate text-callout font-medium",
                      current && "text-niche",
                    )}
                  >
                    {track.title}
                  </span>
                  <span className="block truncate text-footnote text-muted-foreground">
                    {[track.artist, track.detail].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="text-footnote text-muted-foreground tabular-nums">
                  {showDuration ? formatDuration(track.durationMs ?? null) : null}
                </span>
              </button>
              {track.spotifyUrl && (unavailable || current) ? (
                <SpotifyLink href={track.spotifyUrl} />
              ) : null}
            </li>
          )
        })}
      </ol>
      <p className="mt-2 text-caption text-subtle">Preview via Apple Music</p>
    </div>
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
            <CdnImage src={src} alt="" fill sizes="96px" className="object-cover" />
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
