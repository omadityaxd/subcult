import { ArrowUpRight } from "lucide-react"
import { SectionHeader } from "@/components/ds/section-header"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { reddit } from "@/lib/links"

const linkClass =
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-border-strong px-4 text-footnote font-medium transition-colors hover:bg-muted"

/**
 * Where the scene talks: each subreddit with one-tap jumps to the week's top
 * posts and an in-sub search. Deep links only, no Reddit API.
 */
export function CommunitySection({ profile }: { profile: NicheProfile }) {
  return (
    <section>
      <SectionHeader overline="Lurk responsibly" title="Community" />
      <ul className="divide-y divide-border border-y border-border">
        {profile.subreddits.map((subreddit) => (
          <li
            key={subreddit}
            className="flex flex-wrap items-center justify-between gap-3 py-5 md:px-2"
          >
            <a
              href={reddit.home(subreddit)}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-1 font-serif text-title-3 italic"
            >
              r/{subreddit}
              <ArrowUpRight
                aria-hidden
                strokeWidth={1.5}
                className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5"
              />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <div className="flex gap-2">
              <a
                href={reddit.topThisWeek(subreddit)}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                Top this week
              </a>
              <a
                href={reddit.searchWithin(subreddit, profile.name)}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                Search the sub
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
