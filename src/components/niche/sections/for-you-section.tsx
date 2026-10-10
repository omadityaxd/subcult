import Link from "next/link"
import { NicheAvatar } from "@/components/ds/niche-avatar"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import type { NichePreset } from "@/lib/niches/catalog"
import type { TrendSource } from "@/lib/niches/lifecycle"
import { LinkList } from "../link-card"

interface ForYouSectionProps {
  profile: NicheProfile
  related: readonly NichePreset[]
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

/** About the niche. On desktop, related niches live in the right rail instead. */
export function ForYouSection({ profile, related, sources }: ForYouSectionProps) {
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

      {related.length > 0 ? (
        <section className="lg:hidden">
          <p className="mb-3 text-overline font-medium text-muted-foreground uppercase">
            You might also be into
          </p>
          <RelatedNiches related={related} />
        </section>
      ) : null}
    </div>
  )
}

export function RelatedNiches({
  related,
  vertical,
}: {
  related: readonly NichePreset[]
  vertical?: boolean
}) {
  return (
    <ul
      className={
        vertical
          ? "space-y-3"
          : "-mx-(--gutter) no-scrollbar flex gap-4 overflow-x-auto px-(--gutter)"
      }
    >
      {related.map((niche) => (
        <li key={niche.slug} className={vertical ? undefined : "w-20 shrink-0"}>
          <Link
            href={`/n/${niche.slug}`}
            transitionTypes={["nav-forward"]}
            className={vertical ? "group flex items-center gap-3" : "group block text-center"}
          >
            <NicheAvatar
              slug={niche.slug}
              name={niche.name}
              palette={niche.palette}
              size={vertical ? "sm" : "md"}
            />
            <span
              className={
                vertical
                  ? "font-serif text-title-3 italic group-hover:underline"
                  : "mt-2 block truncate text-footnote font-medium"
              }
            >
              {niche.name}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
