import { ArrowUpRight } from "lucide-react"

export interface ExternalChip {
  title: string
  href: string
  /** Where it goes ("Spotify", "Pinterest"), for screen readers. */
  site: string
}

/** Searches on other sites as a compact secondary row, never as feed cards. */
export function ExternalChips({ label, links }: { label: string; links: readonly ExternalChip[] }) {
  if (links.length === 0) return null
  return (
    <section aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-overline font-medium text-muted-foreground uppercase">
        {label}
      </span>
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${link.title} on ${link.site} (opens in a new tab)`}
          className="inline-flex h-7 items-center gap-0.5 rounded-full border border-border px-2.5 text-caption font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {link.title}
          <ArrowUpRight aria-hidden className="size-3" strokeWidth={1.75} />
        </a>
      ))}
    </section>
  )
}
