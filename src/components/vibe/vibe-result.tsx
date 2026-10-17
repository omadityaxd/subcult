"use client"

import { ArrowRight, RotateCcw, Share2 } from "lucide-react"
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react"
import Image from "next/image"
import Link from "next/link"
import { type ReactNode, useEffect, useState } from "react"
import { Cover } from "@/components/ds/cover"
import { springs } from "@/lib/design/tokens"
import type { MixNiche } from "@/lib/vibe/data"
import { encodeMix } from "@/lib/vibe/score"
import { cn } from "@/lib/utils"

interface VibeResultProps {
  mix: readonly MixNiche[]
  blurb: string
  /** Shown on the result right after the quiz; hidden on someone else's shared link. */
  onRetake?: () => void
  /** A visitor viewing a shared result gets "take your own" instead of share. */
  shared?: boolean
  /** Rendered in the hero's top-right corner (e.g. a close button). */
  corner?: ReactNode
}

/** The hero moment: big serif type, the niche covers and percentages counting up. */
export function VibeResult({ mix, blurb, onRetake, shared, corner }: VibeResultProps) {
  const [top] = mix
  const reduceMotion = useReducedMotion()
  if (!top) return null

  return (
    <div className="pb-16">
      <div className="relative md:container-page md:pt-8">
        {corner}
        <Cover
          palette={top.palette}
          seed={`vibe-${top.slug}`}
          className="relative flex min-h-[34rem] flex-col justify-end overflow-hidden p-6 pt-40 text-white md:min-h-[30rem] md:rounded-3xl md:p-10"
        >
          {top.imageUrl ? (
            <Image
              src={top.imageUrl}
              alt=""
              fill
              unoptimized
              sizes="100vw"
              className="object-cover opacity-80 saturate-[0.85]"
            />
          ) : null}
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/0"
          />
          <motion.div
            className="relative"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springs.gentle}
          >
            <p className="text-overline font-medium text-white/70 uppercase">
              {shared ? "A friend's vibe check" : "Your vibe check"}
            </p>
            <h1 className="mt-3 font-serif text-[clamp(3.25rem,13vw,6.5rem)] leading-[0.92] tracking-tight text-balance italic">
              {shared ? null : "You're "}
              <CountUp value={top.percent} delay={0.2} />% {top.name}
            </h1>
            <p className="mt-5 max-w-xl text-headline text-pretty text-white/90">{blurb}</p>
          </motion.div>
        </Cover>
      </div>

      <div className="container-page mt-8 space-y-3 md:mt-10">
        {mix.map((niche, index) => (
          <MixRow key={niche.slug} niche={niche} rank={index} />
        ))}
      </div>

      <div className="container-page mt-10">
        <p className="mb-3 text-overline font-medium text-muted-foreground uppercase">
          Explore your niches
        </p>
        <div className="flex flex-wrap gap-2">
          {mix.map((niche, index) => (
            <Link
              key={niche.slug}
              href={`/n/${niche.slug}`}
              transitionTypes={["nav-forward"]}
              className={cn(
                "inline-flex h-12 items-center gap-2 rounded-full px-5 text-callout font-semibold transition-transform active:scale-[0.97]",
                index === 0
                  ? "bg-foreground text-background"
                  : "border border-border-strong hover:bg-muted",
              )}
            >
              {niche.name}
              <ArrowRight aria-hidden className="size-4" strokeWidth={1.75} />
            </Link>
          ))}
        </div>
        {shared ? null : (
          <Link
            href={`/start?mix=${mix.map((niche) => niche.slug).join(",")}`}
            className="mt-8 flex h-14 w-full items-center justify-between rounded-2xl bg-foreground px-5 text-callout font-semibold text-background transition-transform active:scale-[0.99] sm:w-auto sm:min-w-80"
          >
            Set up my feed
            <ArrowRight aria-hidden className="size-4" strokeWidth={1.75} />
          </Link>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          {shared ? (
            <Link
              href="/vibe-check"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-6 text-callout font-semibold text-background"
            >
              Take your own vibe check
            </Link>
          ) : (
            <ShareButton mix={mix} />
          )}
          {onRetake ? (
            <button
              type="button"
              onClick={onRetake}
              className="inline-flex h-12 items-center gap-2 rounded-full px-5 text-callout font-medium text-muted-foreground hover:bg-muted"
            >
              <RotateCcw aria-hidden className="size-4" strokeWidth={1.5} />
              Retake
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function MixRow({ niche, rank }: { niche: MixNiche; rank: number }) {
  const reduceMotion = useReducedMotion()
  return (
    <Link
      href={`/n/${niche.slug}`}
      transitionTypes={["nav-forward"]}
      className="group flex items-center gap-4 rounded-2xl border border-border p-3 transition-colors hover:bg-muted"
    >
      <Cover
        palette={niche.palette}
        seed={niche.slug}
        className="relative size-20 shrink-0 overflow-hidden rounded-xl md:size-24"
      >
        {niche.imageUrl ? (
          <Image
            src={niche.imageUrl}
            alt=""
            fill
            sizes="96px"
            unoptimized
            className="object-cover"
          />
        ) : null}
      </Cover>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="line-clamp-2 font-serif text-title-2 leading-[1.05] italic">
            {niche.name}
          </span>
          <span className="font-serif text-title-2 tabular-nums">
            <CountUp value={niche.percent} delay={0.35 + rank * 0.15} />%
          </span>
        </div>
        <p className="mt-0.5 truncate text-footnote text-muted-foreground">{niche.tagline}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: niche.palette[3] }}
            initial={reduceMotion ? false : { width: 0 }}
            animate={{ width: `${niche.percent}%` }}
            transition={{ ...springs.gentle, delay: 0.35 + rank * 0.15 }}
          />
        </div>
      </div>
    </Link>
  )
}

/** Animated number (static under reduced motion). */
function CountUp({ value, delay = 0 }: { value: number; delay?: number }) {
  const reduceMotion = useReducedMotion()
  const count = useMotionValue(reduceMotion ? value : 0)
  const rounded = useTransform(count, (latest) => Math.round(latest))
  useEffect(() => {
    if (reduceMotion) return
    const controls = animate(count, value, { duration: 1.1, delay, ease: [0.22, 1, 0.36, 1] })
    return () => controls.stop()
  }, [count, delay, reduceMotion, value])
  return <motion.span>{rounded}</motion.span>
}

function ShareButton({ mix }: { mix: readonly MixNiche[] }) {
  const [copied, setCopied] = useState(false)
  const share = async () => {
    const url = `${window.location.origin}/vibe-check/r/${encodeMix(mix)}`
    const text = `I'm ${mix[0].percent}% ${mix[0].name}. What's your niche, actually?`
    try {
      if (navigator.share) {
        await navigator.share({ title: "My vibe check · subcult", text, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Share sheet dismissed: nothing to do.
    }
  }
  return (
    <button
      type="button"
      onClick={() => void share()}
      className="inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-6 text-callout font-semibold text-background active:scale-[0.97]"
    >
      <Share2 aria-hidden className="size-4" strokeWidth={1.75} />
      {copied ? "Link copied" : "Share your result"}
    </button>
  )
}
