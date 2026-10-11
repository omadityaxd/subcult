"use client"

import { ArrowUpRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { type CSSProperties, useEffect, useState } from "react"
import type { ArtistSheetData } from "@/app/api/artists/[slug]/route"
import { MediaImage } from "@/components/ds/media-image"
import { NicheAvatar } from "@/components/ds/niche-avatar"
import { ResponsiveSheet } from "@/components/ds/responsive-sheet"
import { Skeleton } from "@/components/ui/skeleton"
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
                  <Image
                    src={artist.imageUrl}
                    alt=""
                    fill
                    sizes="80px"
                    unoptimized
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

export function ArtistSheet({
  artist,
  themeStyle,
  onClose,
}: {
  artist: ArtistRef
  themeStyle?: CSSProperties
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

  return (
    <ResponsiveSheet
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={artist.name}
      themeStyle={themeStyle}
    >
      <div className="flex items-center gap-4">
        <span className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-muted">
          {artist.imageUrl ? (
            <MediaImage src={artist.imageUrl} alt={artist.name} sizes="96px" />
          ) : null}
        </span>
        {data ? (
          <a
            href={data.artist.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-5 text-callout font-semibold text-background active:scale-[0.97]"
          >
            Open in Spotify
            <ArrowUpRight aria-hidden className="size-4" strokeWidth={1.75} />
          </a>
        ) : null}
      </div>

      <p className="mt-6 mb-2 text-overline font-medium text-muted-foreground uppercase">
        Top tracks
      </p>
      {!data && !failed ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : data && data.tracks.length > 0 ? (
        <ul className="divide-y divide-border">
          {data.tracks.map((track) => (
            <li key={track.id}>
              <a
                href={track.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 py-2.5"
              >
                <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {track.imageUrl ? <MediaImage src={track.imageUrl} alt="" sizes="44px" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-callout font-medium">{track.title}</span>
                  <span className="block truncate text-footnote text-muted-foreground">
                    {track.album}
                  </span>
                </span>
                <ArrowUpRight
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                  strokeWidth={1.5}
                />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-callout text-muted-foreground">
          Tracks are taking a breather. Open Spotify for the full catalogue.
        </p>
      )}

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
    </ResponsiveSheet>
  )
}
