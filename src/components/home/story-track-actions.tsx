"use client"

import { Loader2, Pause, Play } from "lucide-react"
import { useMemo } from "react"
import { SpotifyLink } from "@/components/music/spotify-link"
import { useTrackPlayer } from "@/components/music/use-track-player"
import type { FeedItem } from "@/lib/feed/types"

/**
 * A story's Sound frame: play the song here (Apple preview, or Spotify's
 * player in-app when there's none). Spotify is the small secondary way out.
 */
export function StoryTrackActions({ item }: { item: FeedItem }) {
  const tracks = useMemo(
    () => [
      {
        id: item.id,
        title: item.title,
        artist: item.subtitle ?? "",
        artworkUrl: item.imageUrl,
        spotifyUrl: item.url || null,
        previewUrl: typeof item.meta.previewUrl === "string" ? item.meta.previewUrl : null,
        niche: typeof item.meta.niche === "string" ? item.meta.niche : null,
      },
    ],
    [item],
  )
  const { play, currentId, playing, pendingId } = useTrackPlayer(tracks, "Stories")
  const active = currentId === item.id && playing
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => play(0)}
        aria-label={`${active ? "Pause" : "Play"} ${item.title}`}
        className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white text-callout font-semibold text-black active:scale-[0.98]"
      >
        {pendingId === item.id ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : active ? (
          <Pause aria-hidden className="size-4" fill="currentColor" strokeWidth={0} />
        ) : (
          <Play aria-hidden className="size-4 translate-x-px" fill="currentColor" strokeWidth={0} />
        )}
        {active ? "Pause" : "Play"}
      </button>
      {item.url ? <SpotifyLink href={item.url} tone="overlay" className="size-12" /> : null}
    </div>
  )
}
