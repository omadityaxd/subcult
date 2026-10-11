"use client"

import { ChevronDown, SkipBack, SkipForward } from "lucide-react"
import { type PanInfo, motion, useReducedMotion } from "motion/react"
import Image from "next/image"
import { useEffect } from "react"
import { createPortal } from "react-dom"
import { SaveButton } from "@/components/ds/save-button"
import { SpotifyEmbed } from "@/components/music/spotify-embed"
import { SpotifyLink } from "@/components/music/spotify-link"
import { getAudioEngine, useAudioState } from "@/lib/audio/use-audio"
import { gestures, springs } from "@/lib/design/tokens"
import { cn } from "@/lib/utils"
import { GenerativeVisual } from "./generative-visual"
import { PlayPause } from "./mini-player"
import { ProgressBar } from "./progress-bar"
import { SaveToSpotify } from "./save-to-spotify"
import { useFullSong } from "./use-full-song"

/** Full-screen Now Playing: big art over a drifting generative field, the queue, save and links. */
export function NowPlaying({ accent, onClose }: { accent: string; onClose: () => void }) {
  const state = useAudioState()
  const reduceMotion = useReducedMotion()
  const track = state.track
  const engine = getAudioEngine()
  const full = useFullSong(track)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [onClose])

  useEffect(() => {
    if (!track) onClose()
  }, [track, onClose])

  if (!track) return null

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > gestures.dismissPx) onClose()
  }

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Now playing"
      className="fixed inset-0 z-[70] overflow-hidden bg-black text-white"
      initial={reduceMotion ? false : { y: "100%" }}
      animate={{ y: 0 }}
      transition={springs.gentle}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.5 }}
      onDragEnd={onDragEnd}
    >
      <GenerativeVisual accent={accent} className="absolute inset-0 size-full" />
      {track.artworkUrl ? (
        <Image
          src={track.artworkUrl}
          alt=""
          fill
          unoptimized
          sizes="100vw"
          className="scale-125 object-cover opacity-25 blur-3xl"
        />
      ) : null}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/80"
      />

      <div className="relative flex h-full flex-col overflow-y-auto px-6 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] md:mx-auto md:grid md:max-w-6xl md:grid-cols-[minmax(0,1fr)_22rem] md:gap-12 md:px-10 md:py-10">
        <div className="flex shrink-0 flex-col md:min-h-0">
          <header className="flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close player"
              className="grid size-10 place-items-center rounded-full hover:bg-white/10"
            >
              <ChevronDown aria-hidden className="size-6" strokeWidth={1.5} />
            </button>
            <p className="min-w-0 truncate text-center text-footnote text-white/75">
              Playing from{" "}
              <span className="font-semibold text-white">{state.context ?? "subcult"}</span>
            </p>
            <span className="size-10" aria-hidden />
          </header>

          <div className="mx-auto mt-8 aspect-square w-full max-w-[min(26rem,78vw)] md:mt-12 md:max-w-[26rem]">
            <div className="relative size-full overflow-hidden rounded-2xl bg-white/10 shadow-pop">
              {track.artworkUrl ? (
                <Image
                  key={track.id}
                  src={track.artworkUrl}
                  alt={`${track.title} artwork`}
                  fill
                  unoptimized
                  sizes="416px"
                  className="object-cover"
                  priority
                />
              ) : null}
            </div>
          </div>

          <div className="mx-auto mt-8 w-full max-w-[26rem]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-title-3 font-semibold">{track.title}</p>
                <p className="truncate text-callout text-white/75">{track.artist}</p>
              </div>
              <SaveButton
                tone="overlay"
                item={{
                  id: track.id,
                  title: track.title,
                  url: track.spotifyUrl ?? track.src,
                  imageUrl: track.artworkUrl ?? null,
                  source: "spotify",
                  subtitle: track.artist,
                }}
              />
            </div>

            {full.active && full.uri && full.mode === "embed" ? (
              <SpotifyEmbed
                key={full.uri}
                uri={full.uri}
                height={80}
                autoPlay
                {...full.embedProps}
                className="mt-6"
              />
            ) : full.active ? (
              <p className="mt-6 text-center text-footnote text-white/75">
                Full song via Spotify Connect
              </p>
            ) : (
              <ProgressBar variant="scrubber" accent={accent} className="mt-6" />
            )}

            <div className="mt-4 flex items-center justify-center gap-8">
              <button
                type="button"
                aria-label="Previous"
                onClick={() => engine.previous()}
                className="grid size-12 place-items-center rounded-full hover:bg-white/10"
              >
                <SkipBack aria-hidden className="size-6" fill="currentColor" strokeWidth={0} />
              </button>
              <PlayPause
                playing={full.active ? full.playing : state.playing}
                onClick={() => (full.active ? full.toggle() : engine.toggle())}
                large
              />
              <button
                type="button"
                aria-label="Next"
                onClick={() => engine.next()}
                disabled={state.index >= state.queue.length - 1}
                className="grid size-12 place-items-center rounded-full hover:bg-white/10 disabled:opacity-30"
              >
                <SkipForward aria-hidden className="size-6" fill="currentColor" strokeWidth={0} />
              </button>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-footnote">
              {full.uri ? (
                <button
                  type="button"
                  onClick={() => (full.active ? full.stop() : full.start())}
                  aria-pressed={full.active}
                  className="h-8 rounded-full bg-white px-4 font-semibold text-black transition-transform active:scale-95"
                >
                  {full.active ? "Back to preview" : "Play full song"}
                </button>
              ) : (
                <span className="rounded-full border border-white/25 px-3 py-1 text-white/80">
                  30s preview
                </span>
              )}
              {track.spotifyUrl ? (
                <SpotifyLink href={track.spotifyUrl} label="Open in Spotify" tone="overlay" />
              ) : null}
              {track.appleUrl ? (
                <a
                  href={track.appleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 hover:text-white hover:underline"
                >
                  Preview via Apple Music
                </a>
              ) : null}
            </div>
            {full.uri && full.mode === "sdk" ? (
              <div className="mt-3 flex justify-center">
                <SaveToSpotify uri={full.uri} />
              </div>
            ) : null}
            {full.error ? (
              <p role="alert" className="mt-3 text-center text-caption text-white/80">
                {full.error}
              </p>
            ) : full.active && full.mode === "embed" ? (
              <p className="mt-3 text-center text-caption text-white/60">
                Full songs play when you&apos;re logged in to Spotify Premium in this browser;
                otherwise Spotify plays its preview.
              </p>
            ) : null}
          </div>
        </div>

        <section
          aria-label="Queue"
          className="mt-10 no-scrollbar shrink-0 md:mt-16 md:min-h-0 md:overflow-y-auto"
        >
          <p className="mb-3 text-overline font-medium text-white/60 uppercase">Queue</p>
          <ol className="space-y-1">
            {state.queue.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() =>
                    engine.playQueue(state.queue, index, {
                      owner: "player",
                      context: state.context,
                    })
                  }
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/10",
                    index === state.index && "bg-white/10",
                  )}
                  aria-current={index === state.index ? "true" : undefined}
                >
                  <span className="relative size-10 shrink-0 overflow-hidden rounded-md bg-white/10">
                    {item.artworkUrl ? (
                      <Image
                        src={item.artworkUrl}
                        alt=""
                        fill
                        sizes="40px"
                        unoptimized
                        className="object-cover"
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-callout font-medium">{item.title}</span>
                    <span className="block truncate text-footnote text-white/60">
                      {item.artist}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </motion.div>,
    document.body,
  )
}
