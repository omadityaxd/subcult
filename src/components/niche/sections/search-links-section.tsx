import type { ReactNode } from "react"
import { LinkCard, SectionHeading } from "../link-card"

interface SearchLinksSectionProps {
  heading: string
  intro: string
  queries: readonly string[]
  toUrl: (query: string) => string
  icon: ReactNode
}

/**
 * A list of curated searches on one platform (Google News for tea, YouTube
 * for watch). The deep-link baseline that live results build on in Phase 4.
 */
export function SearchLinksSection({
  heading,
  intro,
  queries,
  toUrl,
  icon,
}: SearchLinksSectionProps) {
  return (
    <section>
      <SectionHeading>{heading}</SectionHeading>
      <p className="-mt-1 mb-4 text-[15px] text-muted-foreground">{intro}</p>
      <div className="space-y-2">
        {queries.map((query) => (
          <LinkCard key={query} href={toUrl(query)} title={query} icon={icon} />
        ))}
      </div>
    </section>
  )
}
