"use client"

import { useState } from "react"
import { MediaImage } from "@/components/ds/media-image"
import { track } from "@/lib/analytics"
import type { FeedItem } from "@/lib/feed/types"
import { youtubeCrop } from "@/lib/images/youtube-crop"
import { cn } from "@/lib/utils"
import { type VoteTally, splitOf } from "@/lib/votes/split"
import { castVote, useMyVote } from "@/lib/votes/store"

const str = (value: unknown) => (typeof value === "string" && value ? value : null)

/** A "this or that" story frame: two looks, tap the one you'd pick, then see everyone's split. */
export function PollFrame({ item }: { item: FeedItem }) {
  const mine = useMyVote(item.id)
  const [tally, setTally] = useState<VoteTally | null>(null)
  const sides = [
    {
      choice: "a" as const,
      title: str(item.meta.aTitle),
      image: str(item.meta.aImage),
      short: item.meta.aShort === true,
    },
    {
      choice: "b" as const,
      title: str(item.meta.bTitle),
      image: str(item.meta.bImage),
      short: item.meta.bShort === true,
    },
  ]
  const { pct, total } = splitOf(tally ?? {}, "a")
  return (
    <div className="relative z-30 mx-auto w-full max-w-sm">
      <p className="text-center font-serif text-title-1 italic">This or that?</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {sides.map((side) => {
          const share = side.choice === "a" ? pct : 100 - pct
          return (
            <button
              key={side.choice}
              type="button"
              disabled={mine !== null}
              onClick={async () => {
                track("poll_voted", { choice: side.choice })
                const counted = await castVote(item.id, side.choice, null)
                if (counted) setTally(counted)
              }}
              aria-label={`Pick ${side.title ?? side.choice}`}
              className={cn(
                "relative aspect-[3/4] overflow-hidden rounded-2xl bg-white/10 transition-transform active:scale-[0.98]",
                mine === side.choice && "ring-2 ring-white",
                mine !== null && mine !== side.choice && "opacity-60",
              )}
            >
              {side.image ? (
                <MediaImage
                  src={side.image}
                  alt=""
                  sizes="190px"
                  className={youtubeCrop(side.image, { short: side.short, frame: "portrait" })}
                />
              ) : null}
              {mine !== null && tally && total > 1 ? (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-left text-title-2 font-semibold tabular-nums">
                  {share}%
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-center text-caption text-white/70" aria-live="polite">
        {mine === null
          ? "Tap the one you'd wear"
          : !tally
            ? "Picked"
            : total <= 1
              ? "You're the first to pick"
              : `${total} votes`}
      </p>
    </div>
  )
}
