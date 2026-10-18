"use client"

import { Loader2, Pause, Play } from "lucide-react"
import { useMemo, useState } from "react"
import { MediaImage } from "@/components/ds/media-image"
import { ResponsiveSheet } from "@/components/ds/responsive-sheet"
import { SaveButton } from "@/components/ds/save-button"
import { SpotifyEmbed } from "@/components/music/spotify-embed"
import { SpotifyLink } from "@/components/music/spotify-link"
import { Equalizer } from "@/components/music/track-list"
import { useTrackPlayer } from "@/components/music/use-track-player"
import { feedItemTrack } from "@/lib/audio/play-tracks"
import { spotifyUriFrom } from "@/lib/audio/spotify-embed"
import type { FeedItem } from "@/lib/feed/types"
import { cn } from "@/lib/utils"
import { ArtistSheet } from "../artists-row"

const savedShape = (item: FeedItem) => ({
  id: item.id,
  title: item.title,
  url: item.url,
  imageUrl: item.imageUrl,
  source: item.source,
  subtitle: item.subtitle,
})

/** Songs, playlists and Spotify artist results: every tap stays in the app. */
export function MusicCard({ item, meta }: { item: FeedItem; meta: string }) {
  if (item.type === "artist") return <SpotifyArtistCard item={item} meta={meta} />
  return <TrackCard item={item} meta={meta} />
}

/**
 * Music is the soundtrack layer, so in feeds a song is a compact row, never a
 * full-bleed album-art card: small art, title, tap to play the 30s preview.
 */
function TrackCard({ item, meta }: { item: FeedItem; meta: string }) {
  const tracks = useMemo(() => [feedItemTrack(item)], [item])
  const { play, currentId, playing, pendingId, missing } = useTrackPlayer(tracks, "For you")
  const current = currentId === item.id
  const unavailable = missing.has(item.id)

  return (
    <article
      data-kind="music"
      className="flex items-center gap-1 rounded-2xl border border-border p-1.5 pr-2"
    >
      <button
        type="button"
        onClick={() => play(0)}
        aria-label={`${current && playing ? "Pause" : "Play"} ${item.title}${item.subtitle ? ` by ${item.subtitle}` : ""}`}
        className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left transition-colors hover:bg-muted"
      >
        <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
          {item.imageUrl ? <MediaImage src={item.imageUrl} alt="" sizes="48px" /> : null}
          <span
            className={cn(
              "absolute inset-0 grid place-items-center bg-black/35 text-white transition-opacity",
              current || pendingId === item.id
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100",
            )}
          >
            {pendingId === item.id ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : current && playing ? (
              <Equalizer />
            ) : (
              <Play
                aria-hidden
                className="size-4 translate-x-px"
                fill="currentColor"
                strokeWidth={0}
              />
            )}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn("block truncate text-callout font-semibold", current && "text-niche")}
          >
            {item.title}
          </span>
          <span className="block truncate text-footnote text-muted-foreground">
            {unavailable
              ? "No preview for this one"
              : [item.subtitle, meta].filter(Boolean).join(" · ")}
          </span>
        </span>
        {current && playing ? (
          <Pause
            aria-hidden
            className="size-4 shrink-0 text-niche"
            fill="currentColor"
            strokeWidth={0}
          />
        ) : null}
      </button>
      <SaveButton item={savedShape(item)} className="size-9 shrink-0" />
    </article>
  )
}

/** A Spotify artist result: our artist sheet when verified, else Spotify's artist embed. */
function SpotifyArtistCard({ item, meta }: { item: FeedItem; meta: string }) {
  const [open, setOpen] = useState(false)
  const slug = typeof item.meta.artistSlug === "string" ? item.meta.artistSlug : null
  const uri = spotifyUriFrom(item.url)
  return (
    <article data-kind="music">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group block w-full text-center"
        aria-label={`Open ${item.title}`}
      >
        <span className="relative mx-auto block aspect-square w-3/4 overflow-hidden rounded-full bg-muted transition-transform group-active:scale-[0.98]">
          {item.imageUrl ? <MediaImage src={item.imageUrl} alt="" sizes="240px" /> : null}
        </span>
        <span className="mt-3 block font-serif text-title-3 italic">{item.title}</span>
        <span className="block text-footnote text-muted-foreground">{meta}</span>
      </button>
      {open && slug ? (
        <ArtistSheet
          artist={{ slug, name: item.title, imageUrl: item.imageUrl }}
          onClose={() => setOpen(false)}
        />
      ) : (
        <ResponsiveSheet open={open} onOpenChange={setOpen} title={item.title}>
          {uri ? <SpotifyEmbed uri={uri} height={380} /> : null}
          <div className="mt-4 flex justify-end">
            <SpotifyLink href={item.url} label="Open in Spotify" />
          </div>
        </ResponsiveSheet>
      )}
    </article>
  )
}
