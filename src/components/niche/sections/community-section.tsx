import { ArrowUpRight, Flame, Search } from "lucide-react"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { reddit } from "@/lib/links"
import { SectionHeading } from "../link-card"

/**
 * Subreddit cards with one-tap jumps to the week's top posts and to an
 * in-sub search for this niche. Deep links only: no Reddit API involved.
 */
export function CommunitySection({ profile }: { profile: NicheProfile }) {
  return (
    <section>
      <SectionHeading>where the group chat lives</SectionHeading>
      <p className="-mt-1 mb-4 text-[15px] text-muted-foreground">
        the subreddits that actually get it. tap in, lurk responsibly.
      </p>
      <ul className="space-y-3">
        {profile.subreddits.map((subreddit) => (
          <li key={subreddit} className="rounded-2xl bg-card p-4">
            <a
              href={reddit.home(subreddit)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between"
            >
              <span className="text-[17px] font-semibold">r/{subreddit}</span>
              <ArrowUpRight aria-hidden className="size-4 text-muted-foreground" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a
                href={reddit.topThisWeek(subreddit)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-full bg-niche/15 py-2 text-[14px] font-medium text-niche transition-transform active:scale-95"
              >
                <Flame aria-hidden className="size-4" />
                top this week
              </a>
              <a
                href={reddit.searchWithin(subreddit, profile.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-full bg-muted py-2 text-[14px] font-medium transition-transform active:scale-95"
              >
                <Search aria-hidden className="size-4" />
                search the sub
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
