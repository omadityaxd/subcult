import type { Taxonomy } from "./graph"

/** Hubs nobody sits above: the ones that get their own Explore page. */
export function rootHubs(taxonomy: Taxonomy): string[] {
  return taxonomy.hubs
    .map((hub) => hub.slug)
    .filter((slug) => !taxonomy.parents(slug).some((p) => taxonomy.node(p)?.type === "hub"))
}

export interface HubSection {
  /** The branch hub, or the root itself when its children are niches directly. */
  slug: string
  name: string
  description: string
  /** Every niche under the branch, direct children first, then their sub-niches. */
  niches: string[]
}

/** A root hub's page, branch by branch, with each niche listed once. */
export function hubSections(taxonomy: Taxonomy, root: string): HubSection[] {
  const hub = taxonomy.hubs.find((h) => h.slug === root)
  if (!hub) return []
  const seen = new Set<string>()
  const descendants = (start: string): string[] => {
    const queue = [...taxonomy.children(start)]
    const result: string[] = []
    while (queue.length > 0) {
      const next = queue.shift() as string
      if (seen.has(next) || taxonomy.node(next)?.type !== "niche") continue
      seen.add(next)
      result.push(next)
      queue.push(...taxonomy.children(next))
    }
    return result
  }
  const branches = hub.children.filter((child) => taxonomy.node(child)?.type === "hub")
  if (branches.length === 0) {
    return [
      {
        slug: hub.slug,
        name: hub.name,
        description: hub.description,
        niches: descendants(hub.slug),
      },
    ]
  }
  return branches.flatMap((branch) => {
    const node = taxonomy.hubs.find((h) => h.slug === branch)
    return node
      ? [
          {
            slug: node.slug,
            name: node.name,
            description: node.description,
            niches: descendants(node.slug),
          },
        ]
      : []
  })
}
