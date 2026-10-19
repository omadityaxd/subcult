"use client"

import { Check, Pause, Play, Undo2, X } from "lucide-react"
import {
  type PanInfo,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Cover } from "@/components/ds/cover"
import { MediaImage } from "@/components/ds/media-image"
import { springs } from "@/lib/design/tokens"
import { MAX_CARDS, MIN_CARDS, nextCard, seededRandom } from "@/lib/vibe/adaptive"
import type { DeckCard, PairSide } from "@/lib/vibe/data"
import type { Answer } from "@/lib/vibe/score"
import { cn } from "@/lib/utils"

const SWIPE_DISTANCE = 110
const SWIPE_VELOCITY = 600
const FLY_OUT = 640
/** Sound cards play this much of the preview. */
const PREVIEW_MS = 5000

const KIND_LABEL: Partial<Record<DeckCard["kind"], string>> = {
  fit: "Fit",
  grail: "Grail",
  pin: "Moodboard",
  sound: "Sound",
}

type Step = { card: DeckCard; answer: Answer }

interface VibeDeckProps {
  pool: readonly DeckCard[]
  /** Same seed on server and client: the first card renders identically on both. */
  seed: number
  onComplete: (steps: readonly Step[]) => void
}

/**
 * The adaptive vibe deck: each card is picked from the answers so far (like
 * 20 questions) and it stops at 10–16 cards once the result is clear. Swipe
 * right for "that's me", left for "not me"; pairs are tapped.
 */
export function VibeDeck({ pool, seed, onComplete }: VibeDeckProps) {
  // The first pick uses its own generator so a double-invoked initializer can't desync it.
  const random = useRef(seededRandom(seed + 1))
  const [current, setCurrent] = useState<DeckCard | null>(() =>
    nextCard(pool, [], seededRandom(seed)),
  )
  const [steps, setSteps] = useState<Step[]>([])
  const [leaving, setLeaving] = useState(false)
  const x = useMotionValue(0)
  const reduceMotion = useReducedMotion()
  const rotate = useTransform(x, [-240, 240], reduceMotion ? [0, 0] : [-14, 14])
  const likeOpacity = useTransform(x, [24, SWIPE_DISTANCE], [0, 1])
  const passOpacity = useTransform(x, [-SWIPE_DISTANCE, -24], [1, 0])
  const isPair = current?.kind === "pair"

  const commit = useCallback(
    (answer: Answer) => {
      if (!current || leaving) return
      const nextSteps = [...steps, { card: current, answer }]
      const finish = () => {
        x.set(0)
        setLeaving(false)
        setSteps(nextSteps)
        const history = nextSteps.map((step) => ({ id: step.card.id, answer: step.answer }))
        const next = nextCard(pool, history, random.current)
        setCurrent(next)
        if (!next) onComplete(nextSteps)
      }
      if (answer === "skip" || answer === "a" || answer === "b" || reduceMotion) {
        finish()
        return
      }
      setLeaving(true)
      void animate(x, answer === "like" ? FLY_OUT : -FLY_OUT, {
        ...springs.snappy,
        velocity: x.getVelocity(),
      }).then(finish)
    },
    [current, leaving, onComplete, pool, reduceMotion, steps, x],
  )

  const undo = useCallback(() => {
    const last = steps.at(-1)
    if (!last || leaving) return
    x.set(0)
    setSteps(steps.slice(0, -1))
    setCurrent(last.card)
  }, [leaving, steps, x])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") commit(isPair ? "b" : "like")
      else if (event.key === "ArrowLeft") commit(isPair ? "a" : "pass")
      else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") commit("skip")
      else if (event.key === "Backspace" || (event.key === "z" && (event.metaKey || event.ctrlKey)))
        undo()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [commit, isPair, undo])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) commit("like")
    else if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) commit("pass")
    else void animate(x, 0, springs.snappy)
  }

  if (!current) return null
  const index = steps.length

  return (
    <div className="flex h-full flex-col" data-testid="vibe-deck" data-card={current.id}>
      <div className="flex items-center justify-between px-1 pb-3">
        <span className="text-footnote text-muted-foreground tabular-nums" aria-live="polite">
          Card {index + 1}
          <span className="text-subtle">
            {" "}
            · {MIN_CARDS}–{MAX_CARDS}
          </span>
        </span>
        <div className="flex h-1 w-40 gap-1" aria-hidden>
          {Array.from({ length: MAX_CARDS }, (_, i) => (
            <span
              key={i}
              className={cn(
                "flex-1 rounded-full",
                i < index ? "bg-foreground" : i < MIN_CARDS ? "bg-border-strong" : "bg-border",
              )}
            />
          ))}
        </div>
      </div>

      <div className="relative flex-1">
        <div className="absolute inset-0 scale-[0.95] opacity-60" aria-hidden>
          <Cover
            palette={current.palette}
            seed={`${current.coverSeed}-behind`}
            className="size-full rounded-[28px]"
          />
        </div>
        {isPair && current.pair ? (
          <PairFace key={current.id} card={current} onPick={commit} />
        ) : (
          <motion.div
            key={current.id}
            className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
            style={{ x, rotate }}
            drag={leaving ? false : "x"}
            dragElastic={0.9}
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={onDragEnd}
            initial={reduceMotion ? false : { scale: 0.95, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={springs.gentle}
            aria-label={current.prompt}
            role="group"
          >
            <CardFace card={current} />
            <motion.span
              aria-hidden
              style={{ opacity: likeOpacity }}
              className="absolute top-14 left-6 -rotate-6 rounded-full border-2 border-white px-4 py-1.5 text-headline font-semibold text-white"
            >
              That&apos;s me
            </motion.span>
            <motion.span
              aria-hidden
              style={{ opacity: passOpacity }}
              className="absolute top-14 right-6 rotate-6 rounded-full border-2 border-white/80 px-4 py-1.5 text-headline font-semibold text-white/90"
            >
              Not me
            </motion.span>
          </motion.div>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 pt-6 pb-2">
        <RoundButton label="Undo" onClick={undo} disabled={steps.length === 0} small>
          <Undo2 aria-hidden strokeWidth={1.5} />
        </RoundButton>
        {isPair ? (
          <button
            type="button"
            onClick={() => commit("skip")}
            className="h-12 rounded-full border border-border-strong px-6 text-callout font-semibold hover:bg-muted"
          >
            Neither
          </button>
        ) : (
          <>
            <RoundButton label="Not me" onClick={() => commit("pass")}>
              <X aria-hidden strokeWidth={1.75} />
            </RoundButton>
            <button
              type="button"
              onClick={() => commit("skip")}
              className="h-10 rounded-full px-4 text-callout font-medium text-muted-foreground hover:bg-muted"
            >
              Skip
            </button>
            <RoundButton label="That's me" onClick={() => commit("like")} primary>
              <Check aria-hidden strokeWidth={1.75} />
            </RoundButton>
          </>
        )}
      </div>
      <p className="hidden pb-2 text-center text-caption text-muted-foreground md:block">
        {isPair
          ? "Left or right arrow picks a side; S for neither."
          : "Use the arrow keys: right for that's me, left for not me, S to skip."}
      </p>
    </div>
  )
}

function Picture({ src, crop, sizes }: { src: string; crop?: boolean; sizes: string }) {
  return (
    <MediaImage
      src={src}
      alt=""
      sizes={sizes}
      priority
      // Shorts thumbnails are pillarboxed 4:3 frames: crop to the video.
      className={crop ? "scale-[1.34]" : undefined}
    />
  )
}

function CardFace({ card }: { card: DeckCard }) {
  const label = KIND_LABEL[card.kind]
  return (
    <Cover
      palette={card.palette}
      seed={card.coverSeed}
      className="relative size-full overflow-hidden rounded-[28px] shadow-pop select-none"
    >
      {card.imageUrl ? (
        <Picture src={card.imageUrl} crop={card.crop} sizes="(min-width: 768px) 420px, 100vw" />
      ) : null}
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/5"
      />
      {label || card.credit ? (
        <span className="absolute top-4 left-4 inline-flex max-w-[80%] items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-caption font-medium text-white backdrop-blur-md">
          {label ? <span className="font-semibold uppercase">{label}</span> : null}
          {card.credit ? <span className="truncate">{card.credit}</span> : null}
        </span>
      ) : null}
      {card.kind === "sound" && card.previewUrl ? (
        <SoundPreview key={card.id} src={card.previewUrl} />
      ) : null}
      <p className="absolute inset-x-6 bottom-7 font-serif text-title-1 text-balance text-white italic">
        {card.prompt}
      </p>
    </Cover>
  )
}

/** Five seconds of the track, starting on its own when the browser allows it. */
function SoundPreview({ src }: { src: string }) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  const play = useCallback(() => {
    const element = audio.current ?? new Audio(src)
    audio.current = element
    element.currentTime = 0
    void element
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false))
  }, [src])

  useEffect(() => {
    play()
    const stop = setTimeout(() => {
      audio.current?.pause()
      setPlaying(false)
    }, PREVIEW_MS)
    return () => {
      clearTimeout(stop)
      audio.current?.pause()
    }
  }, [play])

  return (
    <button
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={() => {
        if (playing) {
          audio.current?.pause()
          setPlaying(false)
        } else play()
      }}
      aria-label={playing ? "Pause preview" : "Play 5-second preview"}
      className="absolute top-1/2 left-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black shadow-pop"
    >
      {playing ? (
        <Pause aria-hidden className="size-8" fill="currentColor" strokeWidth={0} />
      ) : (
        <Play aria-hidden className="size-8 translate-x-0.5" fill="currentColor" strokeWidth={0} />
      )}
    </button>
  )
}

/** "This or that": two looks side by side, tap the one that's more you. */
function PairFace({ card, onPick }: { card: DeckCard; onPick: (answer: Answer) => void }) {
  const sides: [PairSide, "a" | "b"][] = card.pair
    ? [
        [card.pair.a, "a"],
        [card.pair.b, "b"],
      ]
    : []
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden rounded-[28px] bg-black text-white shadow-pop">
      <p className="px-6 pt-6 pb-4 text-center font-serif text-title-1 italic">{card.prompt}</p>
      <div className="grid flex-1 grid-cols-2 gap-1.5 px-1.5 pb-1.5">
        {sides.map(([side, answer]) => (
          <button
            key={answer}
            type="button"
            onClick={() => onPick(answer)}
            aria-label={`Pick ${side.label ?? (answer === "a" ? "left" : "right")}`}
            className="group relative overflow-hidden rounded-[22px] bg-white/10 active:scale-[0.98]"
          >
            <Picture src={side.imageUrl} crop={side.crop} sizes="(min-width: 768px) 210px, 50vw" />
            {side.label ? (
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent p-3 pt-8 text-left text-caption font-medium">
                {side.label}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  )
}

function RoundButton({
  label,
  onClick,
  children,
  primary,
  small,
  disabled,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  primary?: boolean
  small?: boolean
  disabled?: boolean
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.9 }}
      transition={springs.press}
      className={cn(
        "grid place-items-center rounded-full transition-colors disabled:opacity-30 [&_svg]:size-6",
        small ? "size-11 [&_svg]:size-5" : "size-16",
        primary
          ? "bg-foreground text-background"
          : "border border-border-strong text-foreground hover:bg-muted",
      )}
    >
      {children}
    </motion.button>
  )
}
