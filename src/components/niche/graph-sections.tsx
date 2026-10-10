import { ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { NicheAvatar } from "@/components/ds/niche-avatar"
import { type NichePreset, TAXONOMY, findPreset } from "@/lib/niches/catalog"
import { ADJACENCY_ORDER, type AdjacencyLabel } from "@/lib/taxonomy/graph"
import { cn } from "@/lib/utils"

const presetsFor = (slugs: readonly string[]): NichePreset[] =>
  slugs.flatMap((slug) => {
    const preset = findPreset(slug)
    return preset ? [preset] : []
  })

const Overline = ({ children }: { children: string }) => (
  <p className="mb-3 text-overline font-medium text-muted-foreground uppercase">{children}</p>
)

/** Compact pill for a niche: avatar + name. */
export function NicheChip({ niche }: { niche: NichePreset }) {
  return (
    <Link
      href={`/n/${niche.slug}`}
      transitionTypes={["nav-forward"]}
      className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-border-strong py-1 pr-4 pl-1 text-callout font-medium whitespace-nowrap transition-colors hover:bg-muted"
    >
      <NicheAvatar
        slug={niche.slug}
        name={niche.name}
        palette={niche.palette}
        imageUrl={niche.imageUrl}
        size="xs"
      />
      {niche.name}
    </Link>
  )
}

function ChipRail({ niches }: { niches: readonly NichePreset[] }) {
  return (
    <ul className="-mx-(--gutter) no-scrollbar flex gap-2 overflow-x-auto px-(--gutter) pb-1">
      {niches.map((niche) => (
        <li key={niche.slug}>
          <NicheChip niche={niche} />
        </li>
      ))}
    </ul>
  )
}

/** "Part of …" links up the graph: hubs go to their Explore page, niches to theirs. */
export function NicheTrail({ slug }: { slug: string }) {
  const parents = TAXONOMY.parents(slug).flatMap((parent) => {
    const node = TAXONOMY.node(parent)
    if (!node) return []
    const href = node.type === "hub" ? `/explore/${hubRoot(parent)}` : `/n/${parent}`
    return [{ slug: parent, name: node.name, href }]
  })
  if (parents.length === 0) return null
  return (
    <p className="text-footnote text-muted-foreground">
      Part of{" "}
      {parents.map((parent, index) => (
        <span key={parent.slug}>
          {index > 0 ? " · " : null}
          <Link href={parent.href} className="font-medium text-foreground hover:underline">
            {parent.name}
          </Link>
        </span>
      ))}
    </p>
  )
}

/** Top-level hub that owns a branch (branch pages live on their umbrella hub's page). */
function hubRoot(hub: string): string {
  const parent = TAXONOMY.parents(hub).find((slug) => TAXONOMY.node(slug)?.type === "hub")
  return parent ? hubRoot(parent) : hub
}

export function GoDeeper({ slug }: { slug: string }) {
  const children = presetsFor(TAXONOMY.children(slug))
  if (children.length === 0) return null
  return (
    <section>
      <Overline>Go deeper</Overline>
      <ChipRail niches={children} />
    </section>
  )
}

/** Directly connected niches, grouped by how they relate (Same scene, The fit, The sound…). */
export function AdjacentNiches({ slug }: { slug: string }) {
  const groups = new Map<AdjacencyLabel, NichePreset[]>()
  for (const { slug: target, label } of TAXONOMY.adjacent(slug)) {
    const preset = findPreset(target)
    if (preset) groups.set(label, [...(groups.get(label) ?? []), preset])
  }
  if (groups.size === 0) return null
  return (
    <div className="space-y-8">
      {ADJACENCY_ORDER.filter((label) => groups.has(label)).map((label) => (
        <section key={label}>
          <Overline>{label}</Overline>
          <ChipRail niches={groups.get(label) ?? []} />
        </section>
      ))}
    </div>
  )
}

/** Less obvious neighbours, two hops out. Renders nothing rather than filler. */
export function TwoHops({ slug, vertical }: { slug: string; vertical?: boolean }) {
  const picks = presetsFor(TAXONOMY.recommend(slug, vertical ? 4 : 6))
  if (picks.length === 0) return null
  return (
    <section>
      <Overline>Two hops away</Overline>
      {vertical ? (
        <ul className="space-y-3">
          {picks.map((niche) => (
            <li key={niche.slug}>
              <Link
                href={`/n/${niche.slug}`}
                transitionTypes={["nav-forward"]}
                className="group flex items-center gap-3"
              >
                <NicheAvatar
                  slug={niche.slug}
                  name={niche.name}
                  palette={niche.palette}
                  imageUrl={niche.imageUrl}
                  size="sm"
                />
                <span className="font-serif text-title-3 italic group-hover:underline">
                  {niche.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ChipRail niches={picks} />
      )}
    </section>
  )
}

/** Collectives and identities around the niche (Drain Gang, Opium, YVL…), with sources. */
export function SceneCommunities({ slug, className }: { slug: string; className?: string }) {
  const communities = TAXONOMY.communitiesOf(slug)
  if (communities.length === 0) return null
  return (
    <section className={className}>
      <Overline>The scene</Overline>
      <ul className="space-y-4">
        {communities.map((community) => (
          <li key={community.slug}>
            <p className="flex items-baseline gap-2">
              <span className="text-headline font-semibold">{community.name}</span>
              <span className="text-caption text-muted-foreground">
                {community.type === "identity" ? "Identity" : "Collective"}
              </span>
            </p>
            <p className="mt-1 text-callout text-muted-foreground">{community.description}</p>
            <a
              href={community.sources[0]}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "mt-1 inline-flex items-center gap-1 text-caption text-muted-foreground hover:text-foreground",
              )}
            >
              Source <ArrowUpRight aria-hidden className="size-3" strokeWidth={1.5} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
