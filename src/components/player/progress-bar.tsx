"use client"

import { getAudioEngine, useAudioProgress } from "@/lib/audio/use-audio"
import { cn } from "@/lib/utils"

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`

/** Thin progress line (mini-player) or a scrubber with times (Now Playing, desktop bar). */
export function ProgressBar({
  variant,
  accent,
  className,
}: {
  variant: "line" | "scrubber"
  accent?: string
  className?: string
}) {
  const { position, duration } = useAudioProgress()
  const ratio = duration > 0 ? Math.min(1, position / duration) : 0

  if (variant === "line") {
    return (
      <span
        aria-hidden
        className={cn("block h-0.5 overflow-hidden rounded-full bg-white/15", className)}
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${ratio * 100}%`, backgroundColor: accent ?? "currentColor" }}
        />
      </span>
    )
  }

  return (
    <div
      className={cn("flex items-center gap-3 text-caption text-current/70 tabular-nums", className)}
    >
      <span className="w-9 text-right">{clock(position)}</span>
      <input
        type="range"
        min={0}
        max={duration || 30}
        step={0.1}
        value={position}
        onChange={(event) => getAudioEngine().seek(Number(event.target.value))}
        aria-label="Seek"
        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md"
        style={{
          backgroundImage: `linear-gradient(${accent ?? "#fff"}, ${accent ?? "#fff"})`,
          backgroundSize: `${ratio * 100}% 100%`,
          backgroundRepeat: "no-repeat",
        }}
      />
      <span className="w-9">{clock(duration)}</span>
    </div>
  )
}
