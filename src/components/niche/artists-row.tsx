"use client"

import { ChevronRight, Pause, Play } from "lucide-react"
import { CdnImage } from "@/components/ds/cdn-image"
import Link from "next/link"
import { type CSSProperties, useEffect, useState } from "react"
import type { ArtistSheetData } from "@/app/api/artists/[slug]/route"
import { MediaImage } from "@/components/ds/media-image"
import { NicheAvatar } from "@/components/ds/niche-avatar"
import { ResponsiveSheet } from "@/components/ds/responsive-sheet"
import { PlayableList } from "@/components/music/track-list"
import { SpotifyEmbed } from "@/components/music/spotify-embed"
import { SpotifyLink } from "@/components/music/spotify-link"
import { spotifyUriFrom } from "@/lib/audio/spotify-embed"
import { useTrackPlayer } from "@/components/music/use-track-player"
import { Skeleton } from "@/components/ui/skeleton"
import type { PlayableTrack } from "@/lib/music/playable"
import { getAudioEngine } from "@/lib/audio/use-audio"
import type { ApiResponse } from "@/lib/request"

export interface ArtistRef {
  slug: string
  name: string
  imageUrl: string | null
}

/** Verified artists as a photo rail. Tap one for a minimal artist sheet. */
export function ArtistsRow({
  artists,
  themeStyle,
}: {
  artists: readonly ArtistRef[]
  themeStyle?: CSSProperties
}) {
  const [open, setOpen] = useState<ArtistRef | null>(null)
  if (artists.length === 0) return null
  return (
    <section>
      <p className="mb-3 text-overline font-medium text-muted-foreground uppercase">Artists</p>
      <ul className="-mx-(--gutter) no-scrollbar flex gap-4 overflow-x-auto px-(--gutter) pb-1">
        {artists.map((artist) => (
          <li key={artist.slug} className="w-20 shrink-0">
            <button
              type="button"
              onClick={() => setOpen(artist)}
              className="group block w-full text-center"
            >
              <span className="relative mx-auto block size-20 overflow-hidden rounded-full bg-muted transition-transform group-active:scale-95">
                {artist.imageUrl ? (
                  <CdnImage
                    src={artist.imageUrl}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <span className="grid size-full place-items-center font-serif text-title-2 italic">
                    {artist.name.charAt(0)}
                  </span>
                )}
              </span>
              <span className="mt-2 block truncate text-footnote font-medium">{artist.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {open ? (
        <ArtistSheet
          key={open.slug}
          artist={open}
          themeStyle={themeStyle}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </section>
  )
}

/**
 * Verified artists as rows (photo, name, why they matter). Every row opens
 * the in-app artist sheet with their top tracks; nothing here leaves the app.
 */
export function ArtistList({
  artists,
  themeStyle,
}: {
  artists: readonly (ArtistRef & { why?: string | null })[]
  themeStyle?: CSSProperties
}) {
  const [open, setOpen] = useState<ArtistRef | null>(null)
  if (artists.length === 0) return null
  return (
    <>
      <ul className="-ml-2 divide-y divide-border">
        {artists.map((artist) => (
          <li key={artist.slug}>
            <button
              type="button"
              onClick={() => setOpen(artist)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-muted"
            >
              <span className="relative size-12 shrink-0 overflow-hidden rounded-full bg-muted">
                {artist.imageUrl ? (
                  <CdnImage
                    src={artist.imageUrl}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                ) : (
                  <span className="grid size-full place-items-center font-serif text-title-3 italic">
                    {artist.name.charAt(0)}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-callout font-semibold">{artist.name}</span>
                {artist.why ? (
                  <span className="block truncate text-footnote text-muted-foreground">
                    {artist.why}
                  </span>
                ) : null}
              </span>
              <ChevronRight
                aria-hidden
                className="size-4 shrink-0 text-subtle"
                strokeWidth={1.75}
              />
            </button>
          </li>
        ))}
      </ul>
      {open ? (
        <ArtistSheet
          key={open.slug}
          artist={open}
          themeStyle={themeStyle}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  )
}

export function ArtistSheet({
  artist: initial,
  themeStyle,
  onClose,
}: {
  artist: ArtistRef
  themeStyle?: CSSProperties
  onClose: () => void
}) {
  // Related artists open in place: the sheet walks the graph without stacking.
  const [artist, setArtist] = useState(initial)
  return (
    <ResponsiveSheet
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={artist.name}
      themeStyle={themeStyle}
    >
      <ArtistSheetBody key={artist.slug} artist={artist} onOpen={setArtist} onClose={onClose} />
    </ResponsiveSheet>
  )
}

function ArtistSheetBody({
  artist,
  onOpen,
  onClose,
}: {
  artist: ArtistRef
  onOpen: (artist: ArtistRef) => void
  onClose: () => void
}) {
  const [data, setData] = useState<ArtistSheetData | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/artists/${artist.slug}`)
      .then((response) => response.json() as Promise<ApiResponse<ArtistSheetData>>)
      .then((body) => {
        if (cancelled) return
        if (body.success) setData(body.data)
        else setFailed(true)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [artist.slug])

  const tracks = data?.tracks ?? []
  return (
    <>
      <div className="flex items-end gap-4">
        <span className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-muted">
          {artist.imageUrl ? (
            <MediaImage src={artist.imageUrl} alt={artist.name} sizes="96px" />
          ) : null}
        </span>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <PlayAll tracks={tracks} context={artist.name} />
          {data ? <SpotifyLink href={data.artist.spotifyUrl} /> : null}
        </div>
      </div>

      <p className="mt-6 mb-1 text-overline font-medium text-muted-foreground uppercase">
        Top tracks
      </p>
      {!data && !failed ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : tracks.length > 0 ? (
        <PlayableList tracks={tracks} context={artist.name} />
      ) : data && spotifyUriFrom(data.artist.spotifyUrl) ? (
        // No 30s previews matched: Spotify's own player for the artist, in-app.
        <SpotifyEmbed uri={spotifyUriFrom(data.artist.spotifyUrl) as string} height={152} />
      ) : null}

      {data && data.related.length > 0 ? (
        <>
          <p className="mt-6 mb-3 text-overline font-medium text-muted-foreground uppercase">
            Fans also dig
          </p>
          <ul className="-mx-1 no-scrollbar flex gap-3 overflow-x-auto px-1 pb-1">
            {data.related.map((other) => (
              <li key={other.slug} className="w-16 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpen(other)}
                  className="group block w-full text-center"
                >
                  <span className="relative mx-auto block size-16 overflow-hidden rounded-full bg-muted transition-transform group-active:scale-95">
                    {other.imageUrl ? (
                      <MediaImage src={other.imageUrl} alt="" sizes="64px" />
                    ) : (
                      <span className="grid size-full place-items-center font-serif text-title-3 italic">
                        {other.name.charAt(0)}
                      </span>
                    )}
                  </span>
                  <span className="mt-1.5 block truncate text-caption font-medium">
                    {other.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {data && data.niches.length > 0 ? (
        <>
          <p className="mt-6 mb-3 text-overline font-medium text-muted-foreground uppercase">
            Lives in
          </p>
          <ul className="flex flex-wrap gap-2">
            {data.niches.map((niche) => (
              <li key={niche.slug}>
                <Link
                  href={`/n/${niche.slug}`}
                  onClick={onClose}
                  className="flex h-10 items-center gap-2 rounded-full border border-border-strong py-1 pr-4 pl-1 text-footnote font-medium hover:bg-muted"
                >
                  <NicheAvatar
                    slug={niche.slug}
                    name={niche.name}
                    palette={niche.palette}
                    imageUrl={niche.imageUrl}
                    size="xs"
                    className="p-0"
                  />
                  {niche.name}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  )
}

function PlayAll({ tracks, context }: { tracks: readonly PlayableTrack[]; context: string }) {
  const { play, currentId, playing } = useTrackPlayer(tracks, context)
  const active = playing && tracks.some((track) => track.id === currentId)
  return (
    <button
      type="button"
      disabled={tracks.length === 0}
      onClick={() => (active ? getAudioEngine().toggle() : play(0))}
      aria-label={active ? `Pause ${context}` : `Play ${context}`}
      className="grid size-12 place-items-center rounded-full bg-foreground text-background shadow-pop transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
    >
      {active ? (
        <Pause aria-hidden className="size-5" fill="currentColor" strokeWidth={0} />
      ) : (
        <Play aria-hidden className="size-5 translate-x-0.5" fill="currentColor" strokeWidth={0} />
      )}
    </button>
  )
}
