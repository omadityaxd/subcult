"use client"

import { ImagePlus, Music2, Pause, Play, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { useTrackPlayer } from "@/components/music/use-track-player"
import { compressPhoto } from "@/lib/fits/compress"
import { FIT_LIMITS } from "@/lib/fits/schema"
import type { FitSong } from "@/db/schema"
import type { Soundtrack } from "@/lib/music/soundtrack"
import type { ApiResponse } from "@/lib/request"
import { cn } from "@/lib/utils"

interface Option {
  slug: string
  name: string
}

/**
 * Post your fit: photo (compressed on the phone, re-encoded on the server),
 * caption, niches, brands, the pieces, and an optional song from our catalog
 * as the fit's soundtrack sticker.
 */
export function PostFitForm({
  handle,
  niches,
  brands,
}: {
  handle: string
  niches: readonly Option[]
  brands: readonly (Option & { niches: readonly string[] })[]
}) {
  const router = useRouter()
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [caption, setCaption] = useState("")
  const [pickedNiches, setPickedNiches] = useState<string[]>([])
  const [pickedBrands, setPickedBrands] = useState<string[]>([])
  const [pieces, setPieces] = useState<{ label: string; brand: string | null }[]>([])
  const [pieceDraft, setPieceDraft] = useState("")
  const [song, setSong] = useState<FitSong | null>(null)
  const [status, setStatus] = useState<"idle" | "posting">("idle")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => (photo ? URL.revokeObjectURL(photo.url) : undefined), [photo])

  const toggle = (list: string[], set: (next: string[]) => void, slug: string, max: number) =>
    set(
      list.includes(slug)
        ? list.filter((s) => s !== slug)
        : list.length < max
          ? [...list, slug]
          : list,
    )

  // Brands of the chosen niches first, then everything else.
  const brandOptions = useMemo(
    () =>
      [...brands].sort(
        (a, b) =>
          Number(b.niches.some((n) => pickedNiches.includes(n))) -
          Number(a.niches.some((n) => pickedNiches.includes(n))),
      ),
    [brands, pickedNiches],
  )

  async function choosePhoto(file: File | undefined) {
    if (!file) return
    setError(null)
    const { blob } = await compressPhoto(file)
    setPhoto({ blob, url: URL.createObjectURL(blob) })
  }

  async function submit() {
    if (!photo) return setError("Add a photo of the fit.")
    setStatus("posting")
    setError(null)
    const form = new FormData()
    form.set("photo", photo.blob, "fit.webp")
    form.set(
      "data",
      JSON.stringify({ caption, niches: pickedNiches, brands: pickedBrands, pieces, song }),
    )
    try {
      const response = await fetch("/api/fits", { method: "POST", body: form })
      const body = (await response.json()) as ApiResponse<{ id: string }>
      if (!body.success) throw new Error(body.error)
      router.push(`/fits/${body.data.id}`)
    } catch (reason) {
      setStatus("idle")
      setError(reason instanceof Error ? reason.message : "Posting failed. Try again.")
    }
  }

  return (
    <div className="space-y-8">
      <label
        className={cn(
          "relative grid cursor-pointer place-items-center overflow-hidden rounded-3xl border border-dashed border-border-strong bg-muted/40",
          photo ? "aspect-auto" : "aspect-[4/5]",
        )}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- local preview (blob URL)
          <img src={photo.url} alt="Your fit" className="max-h-[70dvh] w-full object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-muted-foreground">
            <ImagePlus aria-hidden className="size-8" strokeWidth={1.5} />
            <span className="text-callout font-medium">Add your fit pic</span>
            <span className="text-caption">Location and camera details are removed.</span>
          </span>
        )}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => void choosePhoto(event.target.files?.[0])}
        />
      </label>

      <label className="block">
        <span className="text-footnote font-medium">Caption</span>
        <textarea
          value={caption}
          onChange={(event) => setCaption(event.target.value.slice(0, FIT_LIMITS.caption))}
          rows={2}
          className="mt-1.5 w-full rounded-xl border border-border-strong bg-transparent p-3 text-body outline-none focus:border-foreground"
          placeholder={`@${handle} · the story of the fit`}
        />
      </label>

      <ChipPicker
        label={`Niches (up to ${FIT_LIMITS.niches})`}
        options={niches}
        picked={pickedNiches}
        onToggle={(slug) => toggle(pickedNiches, setPickedNiches, slug, FIT_LIMITS.niches)}
      />
      <ChipPicker
        label={`Brands (up to ${FIT_LIMITS.brands})`}
        options={brandOptions}
        picked={pickedBrands}
        onToggle={(slug) => toggle(pickedBrands, setPickedBrands, slug, FIT_LIMITS.brands)}
      />

      <section>
        <p className="text-footnote font-medium">The pieces</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {pieces.map((piece, index) => (
            <li key={`${piece.label}-${index}`}>
              <button
                type="button"
                onClick={() => setPieces(pieces.filter((_, i) => i !== index))}
                className="inline-flex h-8 items-center gap-1 rounded-full bg-muted px-3 text-footnote"
                aria-label={`Remove ${piece.label}`}
              >
                {piece.label}
                <X aria-hidden className="size-3.5" strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
        {pieces.length < FIT_LIMITS.pieces ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              const label = pieceDraft.trim().slice(0, FIT_LIMITS.pieceLabel)
              if (label) setPieces([...pieces, { label, brand: null }])
              setPieceDraft("")
            }}
            className="mt-2 flex gap-2"
          >
            <input
              value={pieceDraft}
              onChange={(event) => setPieceDraft(event.target.value)}
              className="h-10 flex-1 rounded-xl border border-border-strong bg-transparent px-3 text-callout outline-none focus:border-foreground"
              placeholder="e.g. leather flares, Geobaskets"
            />
            <button
              type="submit"
              className="h-10 rounded-full border border-border-strong px-4 text-footnote font-semibold"
            >
              Add
            </button>
          </form>
        ) : null}
      </section>

      <SongPicker niches={pickedNiches} song={song} onPick={setSong} />

      {error ? (
        <p role="alert" className="text-callout text-muted-foreground">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void submit()}
        disabled={status === "posting" || !photo}
        className="h-12 w-full rounded-full bg-foreground text-callout font-semibold text-background disabled:opacity-50"
      >
        {status === "posting" ? "Posting…" : "Post fit"}
      </button>
    </div>
  )
}

function ChipPicker({
  label,
  options,
  picked,
  onToggle,
}: {
  label: string
  options: readonly Option[]
  picked: readonly string[]
  onToggle: (slug: string) => void
}) {
  return (
    <fieldset>
      <legend className="text-footnote font-medium">{label}</legend>
      <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
        {options.map((option) => {
          const on = picked.includes(option.slug)
          return (
            <button
              key={option.slug}
              type="button"
              onClick={() => onToggle(option.slug)}
              aria-pressed={on}
              className={cn(
                "h-8 rounded-full px-3 text-footnote font-medium transition-colors",
                on ? "bg-foreground text-background" : "border border-border-strong hover:bg-muted",
              )}
            >
              {option.name}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Songs come from the chosen niches' soundtracks: our catalog, with real previews. */
function SongPicker({
  niches,
  song,
  onPick,
}: {
  niches: readonly string[]
  song: FitSong | null
  onPick: (song: FitSong | null) => void
}) {
  const [tracks, setTracks] = useState<FitSong[]>([])
  const key = niches.join(",")

  useEffect(() => {
    let cancelled = false
    if (!key) return
    Promise.all(
      key.split(",").map((slug) =>
        fetch(`/api/music/soundtrack?niche=${slug}`)
          .then((response) => response.json() as Promise<ApiResponse<Soundtrack>>)
          .then((body) => (body.success ? body.data.tracks : []))
          .catch(() => []),
      ),
    ).then((lists) => {
      if (cancelled) return
      setTracks(
        lists.flat().map((track) => ({
          title: track.title,
          artist: track.artist,
          previewUrl: track.previewUrl,
          artworkUrl: track.artworkUrl,
          spotifyUrl: track.spotifyUrl,
        })),
      )
    })
    return () => {
      cancelled = true
    }
  }, [key])

  const playable = useMemo(
    () => tracks.map((track) => ({ ...track, id: track.previewUrl })),
    [tracks],
  )
  const { play, currentId, playing } = useTrackPlayer(playable, "Pick a song")

  return (
    <section>
      <p className="text-footnote font-medium">Soundtrack (optional)</p>
      {song ? (
        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-muted py-1 pr-1 pl-3 text-footnote">
          <Music2 aria-hidden className="size-4" strokeWidth={1.75} />
          <span className="font-semibold">{song.title}</span>
          <span className="text-muted-foreground">{song.artist}</span>
          <button
            type="button"
            onClick={() => onPick(null)}
            aria-label="Remove song"
            className="grid size-7 place-items-center rounded-full hover:bg-background"
          >
            <X aria-hidden className="size-3.5" strokeWidth={2} />
          </button>
        </div>
      ) : !key ? (
        <p className="mt-1 text-caption text-muted-foreground">
          Pick a niche to choose from its soundtrack.
        </p>
      ) : (
        <ul className="mt-2 max-h-64 divide-y divide-border overflow-y-auto rounded-2xl border border-border">
          {playable.map((track, index) => {
            const active = currentId === track.id && playing
            return (
              <li key={track.id} className="flex items-center gap-2 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => play(index)}
                  aria-label={`${active ? "Pause" : "Preview"} ${track.title}`}
                  className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-muted"
                >
                  {active ? (
                    <Pause aria-hidden className="size-4" fill="currentColor" strokeWidth={0} />
                  ) : (
                    <Play aria-hidden className="size-4" fill="currentColor" strokeWidth={0} />
                  )}
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-footnote font-semibold">{track.title}</span>
                  <span className="block truncate text-caption text-muted-foreground">
                    {track.artist}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onPick(tracks[index])}
                  className="h-8 shrink-0 rounded-full border border-border-strong px-3 text-caption font-semibold hover:bg-muted"
                >
                  Use
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
