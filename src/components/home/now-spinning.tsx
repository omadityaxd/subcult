"use client"

import { Loader2, Pause, Play } from "lucide-react"
import { MediaImage } from "@/components/ds/media-image"
import { Equalizer } from "@/components/music/track-list"
import { useTrackPlayer } from "@/components/music/use-track-player"
import type { PlayableTrack } from "@/lib/music/playable"
import { cn } from "@/lib/utils"

/** The soundtrack layer on For You: a row of small tiles, nothing louder. */
export function NowSpinning({ tracks }: { tracks: readonly PlayableTrack[] }) {
  const { play, currentId, playing, pendingId } = useTrackPlayer(tracks, "Now spinning")
  if (tracks.length === 0) return null
  return (
    <section aria-label="Now spinning">
      <p className="mb-2.5 text-overline font-medium text-muted-foreground uppercase">
        Now spinning
      </p>
      <ul className="-mx-(--gutter) no-scrollbar flex gap-3 overflow-x-auto px-(--gutter) pb-1">
        {tracks.map((track, index) => {
          const current = track.id === currentId
          return (
            <li key={track.id} className="w-24 shrink-0">
              <button
                type="button"
                onClick={() => play(index)}
                aria-label={`${current && playing ? "Pause" : "Play"} ${track.title} by ${track.artist}`}
                className="group block w-full text-left"
              >
                <span className="relative block size-24 overflow-hidden rounded-xl bg-muted">
                  {track.artworkUrl ? (
                    <MediaImage src={track.artworkUrl} alt="" sizes="96px" />
                  ) : null}
                  <span
                    className={cn(
                      "absolute right-1.5 bottom-1.5 grid size-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md transition-opacity",
                      current || pendingId === track.id
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100 max-md:opacity-100",
                    )}
                  >
                    {pendingId === track.id ? (
                      <Loader2 aria-hidden className="size-3.5 animate-spin" />
                    ) : current && playing ? (
                      <Pause aria-hidden className="size-3.5" fill="currentColor" strokeWidth={0} />
                    ) : (
                      <Play
                        aria-hidden
                        className="size-3.5 translate-x-px"
                        fill="currentColor"
                        strokeWidth={0}
                      />
                    )}
                  </span>
                </span>
                <span
                  className={cn(
                    "mt-1.5 flex items-center gap-1 truncate text-caption font-semibold",
                    current && "text-niche",
                  )}
                >
                  {current && playing ? <Equalizer /> : null}
                  <span className="truncate">{track.title}</span>
                </span>
                <span className="block truncate text-caption text-muted-foreground">
                  {track.artist}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
