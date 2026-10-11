"use client"

import { ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * The one way out to Spotify: small, secondary, never the main tap target.
 * `tone="overlay"` for use on artwork / dark surfaces.
 */
export function SpotifyLink({
  href,
  label = "Spotify",
  tone = "default",
  className,
}: {
  href: string
  label?: string
  tone?: "default" | "overlay"
  className?: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      aria-label={`Open in Spotify (opens in a new tab)`}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-0.5 rounded-full px-2.5 text-caption font-medium transition-colors",
        tone === "overlay"
          ? "bg-black/45 text-white backdrop-blur-md hover:bg-black/60"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {label}
      <ArrowUpRight aria-hidden className="size-3" strokeWidth={1.75} />
    </a>
  )
}
