"use client"

import { cn } from "@/lib/utils"

/** Spotify's mark (circle and three sound arcs), drawn small in the current color. */
export function SpotifyGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <g fill="none" stroke="var(--glyph-ink, #000)" strokeLinecap="round">
        <path d="M6.2 9.4c3.9-1.2 8.3-.9 11.8 1" strokeWidth="1.9" />
        <path d="M6.9 12.6c3.2-.9 6.6-.6 9.5.9" strokeWidth="1.6" />
        <path d="M7.4 15.6c2.6-.7 5.2-.4 7.4.7" strokeWidth="1.4" />
      </g>
    </svg>
  )
}

/**
 * The one way out to Spotify: a small icon, secondary, never the main tap
 * target (playing happens in-app). `tone="overlay"` for artwork and dark
 * surfaces.
 */
export function SpotifyLink({
  href,
  label = "Open in Spotify",
  tone = "default",
  className,
}: {
  href: string
  /** Accessible name; the link shows only the icon. */
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
      aria-label={`${label} (opens in a new tab)`}
      title={label}
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full transition-colors",
        tone === "overlay"
          ? "bg-black/45 text-white backdrop-blur-md [--glyph-ink:#000] hover:bg-black/60"
          : "text-muted-foreground [--glyph-ink:var(--background)] hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <SpotifyGlyph className="size-4" />
    </a>
  )
}
