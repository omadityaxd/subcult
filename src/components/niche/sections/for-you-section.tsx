import type { NicheProfile } from "@/lib/engine/profile-schema"
import type { TrendSource } from "@/lib/niches/lifecycle"
import { LinkList } from "../link-card"

interface ForYouSectionProps {
  profile: NicheProfile
  /** Evidence for trending niches (empty for evergreen ones). */
  sources: readonly TrendSource[]
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return undefined
  }
}

/** About the niche (in the right rail on desktop) and, for trending niches, the evidence. */
export function ForYouSection({ profile, sources }: ForYouSectionProps) {
  return (
    <div className="space-y-10">
      <section className="lg:hidden">
        <p className="text-body leading-relaxed text-pretty text-muted-foreground">
          {profile.description}
        </p>
      </section>

      {sources.length > 0 ? (
        <section>
          <p className="mb-3 text-overline font-medium text-muted-foreground uppercase">
            Why it&apos;s trending
          </p>
          <LinkList
            links={sources.map((source) => ({
              title: source.title,
              href: source.url,
              meta: hostOf(source.url),
            }))}
          />
        </section>
      ) : null}
    </div>
  )
}
