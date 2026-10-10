"use client"

import { Check, Undo2, X } from "lucide-react"
import {
  type PanInfo,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react"
import { useCallback, useEffect, useState } from "react"
import { Cover } from "@/components/ds/cover"
import { MediaImage } from "@/components/ds/media-image"
import { springs } from "@/lib/design/tokens"
import type { DeckCard } from "@/lib/vibe/data"
import type { Answer } from "@/lib/vibe/score"
import { cn } from "@/lib/utils"

const SWIPE_DISTANCE = 110
const SWIPE_VELOCITY = 600
const FLY_OUT = 640

interface VibeDeckProps {
  cards: readonly DeckCard[]
  onComplete: (answers: Record<string, Answer>) => void
}

/**
 * Tinder-style vibe cards: swipe right for "that's me", left for "not me",
 * or use the buttons / arrow keys. Skip doesn't count either way; undo
 * brings the last card back.
 */
export function VibeDeck({ cards, onComplete }: VibeDeckProps) {
  const [history, setHistory] = useState<{ id: string; answer: Answer }[]>([])
  const [leaving, setLeaving] = useState(false)
  const x = useMotionValue(0)
  const reduceMotion = useReducedMotion()
  const rotate = useTransform(x, [-240, 240], reduceMotion ? [0, 0] : [-14, 14])
  const likeOpacity = useTransform(x, [24, SWIPE_DISTANCE], [0, 1])
  const passOpacity = useTransform(x, [-SWIPE_DISTANCE, -24], [1, 0])

  const index = history.length
  const card = cards[index]
  const nextCard = cards[index + 1]

  const commit = useCallback(
    (answer: Answer) => {
      if (!card || leaving) return
      const nextHistory = [...history, { id: card.id, answer }]
      const finish = () => {
        x.set(0)
        setLeaving(false)
        setHistory(nextHistory)
        if (nextHistory.length === cards.length) {
          onComplete(Object.fromEntries(nextHistory.map((entry) => [entry.id, entry.answer])))
        }
      }
      if (answer === "skip" || reduceMotion) {
        finish()
        return
      }
      setLeaving(true)
      void animate(x, answer === "like" ? FLY_OUT : -FLY_OUT, {
        ...springs.snappy,
        velocity: x.getVelocity(),
      }).then(finish)
    },
    [card, cards.length, history, leaving, onComplete, reduceMotion, x],
  )

  const undo = useCallback(() => {
    if (history.length === 0 || leaving) return
    x.set(0)
    setHistory(history.slice(0, -1))
  }, [history, leaving, x])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") commit("like")
      else if (event.key === "ArrowLeft") commit("pass")
      else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") commit("skip")
      else if (event.key === "Backspace" || (event.key === "z" && (event.metaKey || event.ctrlKey)))
        undo()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [commit, undo])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) commit("like")
    else if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) commit("pass")
    else void animate(x, 0, springs.snappy)
  }

  if (!card) return null

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-1 pb-3">
        <span className="text-footnote text-muted-foreground tabular-nums" aria-live="polite">
          {index + 1} / {cards.length}
        </span>
        <div className="flex h-1 w-40 gap-1" aria-hidden>
          {cards.map((c, i) => (
            <span
              key={c.id}
              className={cn(
                "flex-1 rounded-full",
                i < index ? "bg-foreground" : "bg-border-strong",
              )}
            />
          ))}
        </div>
      </div>

      <div className="relative flex-1">
        {nextCard ? (
          <div className="absolute inset-0 scale-[0.95] opacity-70" aria-hidden>
            <CardFace card={nextCard} />
          </div>
        ) : null}
        <motion.div
          key={card.id}
          className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
          style={{ x, rotate }}
          drag={leaving ? false : "x"}
          dragElastic={0.9}
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={onDragEnd}
          initial={reduceMotion ? false : { scale: 0.95, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={springs.gentle}
          aria-label={card.prompt}
          role="group"
        >
          <CardFace card={card} />
          <motion.span
            aria-hidden
            style={{ opacity: likeOpacity }}
            className="absolute top-6 left-6 -rotate-6 rounded-full border-2 border-white px-4 py-1.5 text-headline font-semibold text-white"
          >
            That&apos;s me
          </motion.span>
          <motion.span
            aria-hidden
            style={{ opacity: passOpacity }}
            className="absolute top-6 right-6 rotate-6 rounded-full border-2 border-white/80 px-4 py-1.5 text-headline font-semibold text-white/90"
          >
            Not me
          </motion.span>
        </motion.div>
      </div>

      <div className="flex items-center justify-center gap-4 pt-6 pb-2">
        <RoundButton label="Undo" onClick={undo} disabled={history.length === 0} small>
          <Undo2 aria-hidden strokeWidth={1.5} />
        </RoundButton>
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
      </div>
      <p className="hidden pb-2 text-center text-caption text-muted-foreground md:block">
        Use the arrow keys: right for that&apos;s me, left for not me, S to skip.
      </p>
    </div>
  )
}

function CardFace({ card }: { card: DeckCard }) {
  return (
    <Cover
      palette={card.palette}
      seed={card.coverSeed}
      className="relative size-full overflow-hidden rounded-[28px] shadow-pop select-none"
    >
      {card.imageUrl ? (
        <MediaImage src={card.imageUrl} alt="" sizes="(min-width: 768px) 420px, 100vw" priority />
      ) : null}
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/5"
      />
      <p className="absolute inset-x-6 bottom-7 font-serif text-title-1 text-balance text-white italic">
        {card.prompt}
      </p>
    </Cover>
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
