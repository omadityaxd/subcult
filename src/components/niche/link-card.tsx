import { ArrowUpRight } from "lucide-react"

export interface ListLink {
  title: string
  href: string
  meta?: string
}

/** Quiet outbound link list: hairline rows, arrow on the right. */
export function LinkList({ links }: { links: readonly ListLink[] }) {
  return (
    <ul className="divide-y divide-border border-y border-border">
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between gap-4 py-4 transition-colors hover:bg-muted/50 md:px-2"
          >
            <span className="min-w-0">
              <span className="block truncate text-body font-medium first-letter:uppercase">
                {link.title}
              </span>
              {link.meta ? (
                <span className="block text-footnote text-muted-foreground">{link.meta}</span>
              ) : null}
            </span>
            <ArrowUpRight
              aria-hidden
              strokeWidth={1.5}
              className="size-[18px] shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  )
}
