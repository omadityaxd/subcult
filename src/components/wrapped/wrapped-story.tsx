"use client"

import { useOverlay } from "@/lib/ui/overlays"
import { Download, X } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Cover } from "@/components/ds/cover"
import { springs } from "@/lib/design/tokens"
import { slideCopy } from "@/lib/wrapped/copy"
import { type Slide, slideNiche } from "@/lib/wrapped/slides"
import { cn } from "@/lib/utils"

const SLIDE_MS = 6000
const NEUTRAL = ["#0a0a0a", "#1a1a1a", "#444444", "#bbbbbb", "#f2f2f2"]

export interface WrappedNiche {
  name: string
  palette: readonly string[]
}

interface WrappedStoryProps {
  slides: readonly Slide[]
  niches: Readonly<Record<string, WrappedNiche>>
  /** Colours slides that aren't about a specific niche. */
  leadNiche: string | null
  onClose: () => void
}

/** Wrapped as a story: tap through, hold to pause, save any slide as a 1080×1920 image. */
export function WrappedStory({ slides, niches, leadNiche, onClose }: WrappedStoryProps) {
  useOverlay(true, onClose)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [saving, setSaving] = useState(false)
  const progressRef = useRef(0)
  const reduceMotion = useReducedMotion()
  const slide = slides[index]
  const nameOf = (slug: string) => niches[slug]?.name ?? slug
  const niche = slideNiche(slide, leadNiche)
  const palette = (niche && niches[niche]?.palette) || NEUTRAL
  const copy = slideCopy(slide, nameOf)

  const go = useCallback(
    (delta: number) => {
      progressRef.current = 0
      setProgress(0)
      const next = index + delta
      if (next >= slides.length) onClose()
      else setIndex(Math.max(0, next))
    },
    [index, onClose, slides.length],
  )

  useEffect(() => {
    if (paused || saving) return
    let raf = 0
    let last = performance.now()
    const tick = (time: number) => {
      progressRef.current += (time - last) / SLIDE_MS
      last = time
      if (progressRef.current >= 1) {
        go(1)
        return
      }
      setProgress(progressRef.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [go, paused, saving])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
      if (event.key === "ArrowRight") go(1)
      if (event.key === "ArrowLeft") go(-1)
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [go, onClose])

  const save = async () => {
    setSaving(true)
    try {
      const response = await fetch("/api/wrapped/slide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slide, niche: leadNiche }),
      })
      if (!response.ok) throw new Error(String(response.status))
      const blob = await response.blob()
      const file = new File([blob], `subcult-wrapped-${slide.kind}.png`, { type: "image/png" })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My subcult Wrapped" })
      } else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = file.name
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch {
      // Share sheet dismissed or render failed: stay on the slide.
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Your Wrapped"
      className="fixed inset-0 z-(--z-fullscreen) bg-black text-white"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springs.gentle}
    >
      <div className="relative mx-auto flex h-full w-full max-w-[min(100vw,30rem)] flex-col overflow-hidden md:my-6 md:h-[calc(100%-3rem)] md:rounded-3xl">
        <Cover
          palette={palette}
          seed={`wrapped-${slide.kind}-${niche ?? ""}`}
          className="absolute inset-0"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black/60"
        />

        <div className="relative z-10 flex gap-1 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          {slides.map((s, i) => (
            <span
              key={`${s.kind}-${i}`}
              className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30"
            >
              <span
                className="block h-full bg-white"
                style={{ width: `${i < index ? 100 : i === index ? progress * 100 : 0}%` }}
              />
            </span>
          ))}
        </div>

        <header className="relative z-30 flex items-center justify-between px-4 pt-3">
          <span className="font-serif text-title-3 italic">subcult wrapped</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              aria-label="Save this slide as an image"
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-footnote font-medium hover:bg-white/10 disabled:opacity-50"
            >
              <Download aria-hidden className="size-4" strokeWidth={1.75} />
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Wrapped"
              className="grid size-10 place-items-center rounded-full hover:bg-white/10"
            >
              <X aria-hidden className="size-6" strokeWidth={1.5} />
            </button>
          </div>
        </header>

        <motion.div
          key={index}
          className="relative z-10 flex flex-1 flex-col justify-center px-7"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.gentle}
        >
          <p className="text-overline font-medium text-white/75 uppercase">{copy.overline}</p>
          <p
            className={cn(
              "mt-3 font-serif leading-[0.95] tracking-tight text-balance italic",
              copy.headline.length > 18 ? "text-[2.75rem]" : "text-[3.75rem]",
            )}
          >
            {copy.headline}
          </p>
          {copy.caption ? <p className="mt-4 text-headline text-white/85">{copy.caption}</p> : null}
          {copy.rows ? (
            <ol className="mt-8 space-y-4">
              {copy.rows.map((row, i) => (
                <li key={`${row.label}-${i}`} className="flex items-center gap-3">
                  <span className="w-5 text-callout text-white/60 tabular-nums">{i + 1}</span>
                  {row.imageUrl ? (
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-lg">
                      <Image
                        src={row.imageUrl}
                        alt=""
                        fill
                        sizes="48px"
                        unoptimized
                        className="object-cover"
                      />
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-title-3 italic">
                      {row.label}
                    </span>
                    {row.detail ? (
                      <span className="block truncate text-footnote text-white/70">
                        {row.detail}
                      </span>
                    ) : null}
                    {row.percent !== undefined ? (
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/20">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${row.percent}%`,
                            backgroundColor: (row.slug && niches[row.slug]?.palette[3]) || "#fff",
                          }}
                        />
                      </span>
                    ) : null}
                  </span>
                  {row.percent !== undefined ? (
                    <span className="text-headline tabular-nums">{row.percent}%</span>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}
        </motion.div>

        <div className="absolute inset-x-0 top-28 bottom-16 z-20 flex">
          <button
            type="button"
            aria-label="Previous slide"
            className="h-full w-1/3"
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => {
              setPaused(false)
              go(-1)
            }}
          />
          <button
            type="button"
            aria-label="Next slide"
            className="h-full flex-1"
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => {
              setPaused(false)
              go(1)
            }}
          />
        </div>
      </div>
    </motion.div>,
    document.body,
  )
}
