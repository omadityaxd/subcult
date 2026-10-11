"use client"

import { Bookmark, Flag, Heart, Music2, Pause, Play, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { BrandSheet } from "@/components/brand/brand-sheet"
import { MediaImage } from "@/components/ds/media-image"
import { useTrackPlayer } from "@/components/music/use-track-player"
import { REPORT_REASONS } from "@/lib/fits/schema"
import type { FitView } from "@/lib/fits/types"
import type { PlayableTrack } from "@/lib/music/playable"
import { cn } from "@/lib/utils"

async function call(path: string, method: "POST" | "DELETE", body?: unknown) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return response.ok
}

/** The fit's soundtrack sticker: tap to play its 30s preview in the shared player. */
export function SongSticker({ fit, compact = false }: { fit: FitView; compact?: boolean }) {
  const tracks = useMemo<PlayableTrack[]>(
    () =>
      fit.song
        ? [
            {
              id: `fit-song:${fit.id}`,
              title: fit.song.title,
              artist: fit.song.artist,
              artworkUrl: fit.song.artworkUrl,
              spotifyUrl: fit.song.spotifyUrl,
              previewUrl: fit.song.previewUrl,
            },
          ]
        : [],
    [fit],
  )
  const { play, currentId, playing } = useTrackPlayer(tracks, `@${fit.handle}'s fit`)
  if (!fit.song) return null
  const active = currentId === tracks[0]?.id && playing
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        play(0)
      }}
      aria-label={`${active ? "Pause" : "Play"} ${fit.song.title} by ${fit.song.artist}`}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full bg-black/60 text-white backdrop-blur-md",
        compact ? "h-7 px-2.5 text-caption" : "h-9 px-3 text-footnote",
      )}
    >
      {active ? (
        <Pause aria-hidden className="size-3.5 shrink-0" fill="currentColor" strokeWidth={0} />
      ) : compact ? (
        <Music2 aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />
      ) : (
        <Play aria-hidden className="size-3.5 shrink-0" fill="currentColor" strokeWidth={0} />
      )}
      <span className="truncate font-semibold">{fit.song.title}</span>
      {compact ? null : <span className="truncate opacity-75">· {fit.song.artist}</span>}
    </button>
  )
}

/** Full fit: photo with its song sticker, who posted it, tags, pieces, like/save/report. */
export function FitDetail({ fit, signedIn }: { fit: FitView; signedIn: boolean }) {
  const router = useRouter()
  const [liked, setLiked] = useState(fit.liked)
  const [likes, setLikes] = useState(fit.likeCount)
  const [saved, setSaved] = useState(fit.saved)
  const [reporting, setReporting] = useState(false)
  const [reported, setReported] = useState(false)
  const [brand, setBrand] = useState<{ slug: string; name: string } | null>(null)
  const needsLogin = () => router.push(`/login?next=${encodeURIComponent(`/fits/${fit.id}`)}`)

  async function toggleLike() {
    if (!signedIn) return needsLogin()
    const next = !liked
    setLiked(next)
    setLikes((count) => Math.max(0, count + (next ? 1 : -1)))
    if (!(await call(`/api/fits/${fit.id}/like`, next ? "POST" : "DELETE"))) {
      setLiked(!next)
      setLikes((count) => Math.max(0, count + (next ? -1 : 1)))
    }
  }

  async function toggleSave() {
    if (!signedIn) return needsLogin()
    const next = !saved
    setSaved(next)
    if (!(await call(`/api/fits/${fit.id}/save`, next ? "POST" : "DELETE"))) setSaved(!next)
  }

  return (
    <div>
      <div
        className="relative w-full overflow-hidden rounded-2xl bg-muted"
        style={{ aspectRatio: `${fit.width} / ${fit.height}`, maxHeight: "70dvh" }}
      >
        <MediaImage
          src={fit.imageUrl}
          alt={fit.caption ?? `Fit by @${fit.handle}`}
          sizes="(max-width: 768px) 100vw, 560px"
        />
        <span className="absolute bottom-3 left-3 max-w-[85%]">
          <SongSticker fit={fit} />
        </span>
      </div>

      <div className="mt-3 flex items-center gap-1">
        <button
          type="button"
          onClick={() => void toggleLike()}
          aria-pressed={liked}
          aria-label={liked ? "Unlike" : "Like"}
          className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 hover:bg-muted"
        >
          <Heart
            aria-hidden
            className={cn("size-5", liked && "fill-niche text-niche")}
            strokeWidth={1.75}
          />
          <span className="text-footnote font-semibold tabular-nums">{likes}</span>
        </button>
        <button
          type="button"
          onClick={() => void toggleSave()}
          aria-pressed={saved}
          aria-label={saved ? "Remove from saved" : "Save"}
          className="grid size-10 place-items-center rounded-full hover:bg-muted"
        >
          <Bookmark
            aria-hidden
            className={cn("size-5", saved && "fill-foreground")}
            strokeWidth={1.75}
          />
        </button>
        <span className="flex-1" />
        {fit.mine ? (
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm("Delete this fit? This can't be undone.")) return
              if (await call(`/api/fits/${fit.id}`, "DELETE")) router.push("/me")
            }}
            aria-label="Delete fit"
            className="grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <Trash2 aria-hidden className="size-[18px]" strokeWidth={1.75} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => (signedIn ? setReporting((value) => !value) : needsLogin())}
            aria-expanded={reporting}
            aria-label="Report"
            className="grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <Flag aria-hidden className="size-[18px]" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {reporting && !reported ? (
        <div className="mt-2 rounded-2xl border border-border p-3">
          <p className="text-footnote font-medium">What&apos;s wrong with this post?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {REPORT_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={async () => {
                  if (await call(`/api/fits/${fit.id}/report`, "POST", { reason }))
                    setReported(true)
                }}
                className="h-8 rounded-full border border-border-strong px-3 text-footnote first-letter:uppercase hover:bg-muted"
              >
                {reason}
              </button>
            ))}
          </div>
        </div>
      ) : reported ? (
        <p role="status" className="mt-2 text-footnote text-muted-foreground">
          Thanks. A human will look at it.
        </p>
      ) : null}

      <p className="mt-2 text-callout">
        <span className="font-semibold">@{fit.handle}</span>
        {fit.caption ? <span className="text-muted-foreground"> {fit.caption}</span> : null}
      </p>

      {fit.pieces.length > 0 ? (
        <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
          {fit.pieces.map((piece, index) => (
            <li
              key={`${piece.label}-${index}`}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-footnote"
            >
              <span className="first-letter:uppercase">{piece.label}</span>
              {piece.brand ? <span className="text-muted-foreground">{piece.brand}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {fit.niches.length > 0 || fit.brands.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {fit.niches.map((niche) => (
            <Link
              key={niche.slug}
              href={`/n/${niche.slug}`}
              className="inline-flex h-8 items-center rounded-full bg-muted px-3 text-footnote font-medium"
            >
              {niche.name}
            </Link>
          ))}
          {fit.brands.map((entry) => (
            <button
              key={entry.slug}
              type="button"
              onClick={() => setBrand(entry)}
              className="inline-flex h-8 items-center rounded-full border border-border-strong px-3 text-footnote font-medium hover:bg-muted"
            >
              {entry.name}
            </button>
          ))}
        </div>
      ) : null}
      {brand ? <BrandSheet brand={brand} onClose={() => setBrand(null)} /> : null}
    </div>
  )
}
