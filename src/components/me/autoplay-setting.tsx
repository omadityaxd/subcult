"use client"

import { setAutoplaySoundtrack, useAutoplaySoundtrack } from "@/lib/audio/player"
import { cn } from "@/lib/utils"

/** Me → Settings: start a niche's soundtrack when you open it (default on). */
export function AutoplaySetting() {
  const enabled = useAutoplaySoundtrack()
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-card px-4 py-3">
      <span>
        <span className="block text-body">Autoplay niche soundtrack</span>
        <span className="block text-footnote text-muted-foreground">
          Plays a niche&apos;s songs when you open it from inside the app.
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Autoplay niche soundtrack"
        onClick={() => setAutoplaySoundtrack(!enabled)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          enabled ? "bg-foreground" : "bg-border-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-6 rounded-full bg-background shadow-sm transition-transform",
            enabled && "translate-x-5",
          )}
        />
      </button>
    </div>
  )
}
