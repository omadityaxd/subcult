"use client"

import { ListMusic, Loader2, Pause, Play } from "lucide-react"
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
  if (item.type === "playlist") return <PlaylistCard item={item} meta={meta} />
  if (item.type === "artist") return <SpotifyArtistCard item={item} meta={meta} />
  return <TrackCard item={item} meta={meta} />
}

/** Tap plays the 30s preview in our player; "Spotify" is a small secondary link. */
function TrackCard({ item, meta }: { item: FeedItem; meta: string }) {
  const tracks = useMemo(() => [feedItemTrack(item)], [item])
  const { play, currentId, playing, pendingId, missing } = useTrackPlayer(tracks, "For you")
  const current = currentId === item.id
  const unavailable = missing.has(item.id)

  return (
    <article className="relative">
      <button
        type="button"
        onClick={() => play(0)}
        aria-label={`${current && playing ? "Pause" : "Play"} ${item.title}${item.subtitle ? ` by ${item.subtitle}` : ""}`}
        className="group block w-full text-left"
      >
        <span className="relative block aspect-square overflow-hidden rounded-2xl bg-muted transition-transform duration-300 ease-out group-active:scale-[0.98]">
          {item.imageUrl ? (
            <MediaImage src={item.imageUrl} alt="" sizes="(max-width: 640px) 100vw, 33vw" />
          ) : null}
          <span
            className={cn(
              "absolute bottom-3 left-3 grid size-12 place-items-center rounded-full bg-niche text-niche-foreground shadow-pop transition-all",
              current || pendingId === item.id
                ? "scale-100 opacity-100"
                : "scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 max-md:scale-100 max-md:opacity-100",
            )}
          >
            {pendingId === item.id ? (
              <Loader2 aria-hidden className="size-5 animate-spin" />
            ) : current && playing ? (
              <Pause aria-hidden className="size-5" fill="currentColor" strokeWidth={0} />
            ) : (
              <Play
                aria-hidden
                className="size-5 translate-x-0.5"
                fill="currentColor"
                strokeWidth={0}
              />
            )}
          </span>
        </span>
        <span className="mt-2.5 flex items-center gap-2 px-0.5">
          {current && playing ? <Equalizer /> : null}
          <span className={cn("line-clamp-2 text-headline font-semibold", current && "text-niche")}>
            {item.title}
          </span>
        </span>
        <span className="mt-0.5 block truncate px-0.5 text-footnote text-muted-foreground">
          {unavailable
            ? "No preview for this one"
            : [item.subtitle, meta].filter(Boolean).join(" · ")}
        </span>
      </button>
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
        <SpotifyLink href={item.url} tone="overlay" />
        <SaveButton item={savedShape(item)} tone="overlay" />
      </div>
    </article>
  )
}

/**
 * Spotify playlists open as an in-app track list. Dev-mode apps can't read
 * other people's playlist items (Feb 2026 API change), so the list is
 * Spotify's own embed, inside our sheet.
 */
function PlaylistCard({ item, meta }: { item: FeedItem; meta: string }) {
  const [open, setOpen] = useState(false)
  const uri = spotifyUriFrom(item.url)
  return (
    <article className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group block w-full text-left"
        aria-label={`Open playlist ${item.title}`}
      >
        <span className="relative block aspect-square overflow-hidden rounded-2xl bg-muted transition-transform duration-300 ease-out group-active:scale-[0.98]">
          {item.imageUrl ? (
            <MediaImage src={item.imageUrl} alt="" sizes="(max-width: 640px) 100vw, 33vw" />
          ) : null}
          <span className="absolute bottom-3 left-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-black/55 px-3 text-footnote font-medium text-white backdrop-blur-md">
            <ListMusic aria-hidden className="size-4" strokeWidth={1.75} />
            Playlist
          </span>
        </span>
        <span className="mt-2.5 line-clamp-2 block px-0.5 text-headline font-semibold">
          {item.title}
        </span>
        <span className="mt-0.5 block truncate px-0.5 text-footnote text-muted-foreground">
          {[item.subtitle, meta].filter(Boolean).join(" · ")}
        </span>
      </button>
      <ResponsiveSheet open={open} onOpenChange={setOpen} title={item.title}>
        {uri ? (
          <SpotifyEmbed uri={uri} height={380} />
        ) : (
          <p className="text-callout text-muted-foreground">
            This playlist can&apos;t be shown here.
          </p>
        )}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-caption text-muted-foreground">
            Previews unless you&apos;re logged in to Spotify Premium here.
          </p>
          <SpotifyLink href={item.url} label="Open in Spotify" />
        </div>
      </ResponsiveSheet>
    </article>
  )
}

/** A Spotify artist result: our artist sheet when verified, else Spotify's artist embed. */
function SpotifyArtistCard({ item, meta }: { item: FeedItem; meta: string }) {
  const [open, setOpen] = useState(false)
  const slug = typeof item.meta.artistSlug === "string" ? item.meta.artistSlug : null
  const uri = spotifyUriFrom(item.url)
  return (
    <article>
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
