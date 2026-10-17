import { toNicheSlug } from "@/lib/engine/slug"
import {
  type Artist,
  type Brand,
  type Creator,
  type Community,
  EDGE_ENDPOINTS,
  type EdgeType,
  type Hub,
  type NicheCuration,
  type NodeType,
  SYMMETRIC_EDGE_TYPES,
  type Tag,
  type TaxonomyFiles,
} from "./schema"

/** The slice of a NicheProfile the graph needs (keeps this module pure and testable). */
export interface ProfileRef {
  slug: string
  name: string
  artists: readonly { name: string }[]
  relatedNiches: readonly string[]
}

export interface GraphNode {
  slug: string
  type: NodeType
  name: string
  aliases: readonly string[]
}

export interface Edge {
  from: string
  type: EdgeType
  to: string
}

/** How an adjacent niche relates to the one you're on, phrased for the UI. */
export type AdjacencyLabel = "Same scene" | "The fit" | "The sound" | "Same aesthetic" | "Related"
export const ADJACENCY_ORDER: readonly AdjacencyLabel[] = [
  "Same scene",
  "The fit",
  "The sound",
  "Same aesthetic",
  "Related",
]

export interface Adjacent {
  slug: string
  label: AdjacencyLabel
}

/** Case/spacing/punctuation-insensitive lookup key: "Opium Fashion" = "opium-fashion". */
export const lookupKey = (text: string): string => toNicheSlug(text)

// Two-hop recommendation weights. Strong scene links count most; popular
// entities (an artist on ten niches) are damped by their degree.
const NICHE_EDGE_WEIGHT: Record<EdgeType, number> = {
  similar_scene: 1,
  overlapping_aesthetic: 0.9,
  fashion_of: 0.9,
  parent: 0.7,
  related: 0.6,
  artist_of: 0,
  brand_of: 0,
  community_of: 0,
  creator_of: 0,
  tagged: 0,
}
const ENTITY_WEIGHT: Partial<Record<NodeType, number>> = {
  collective: 0.8,
  identity: 0.8,
  artist: 0.6,
  brand: 0.6,
  tag: 0.4,
}
const MIN_RECOMMENDATION_SCORE = 0.6

export class TaxonomyError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid taxonomy:\n- ${problems.join("\n- ")}`)
    this.name = "TaxonomyError"
  }
}

export interface Taxonomy {
  readonly edges: readonly Edge[]
  readonly hubs: readonly Hub[]
  node(slug: string): GraphNode | undefined
  /** Name, alias or slug → node slug (optionally of one type). */
  resolve(text: string, type?: NodeType): string | undefined
  curation(slug: string): NicheCuration | undefined
  children(slug: string): string[]
  parents(slug: string): string[]
  /** Nearest hub above a niche or hub (its branch), if any. */
  branchOf(slug: string): string | undefined
  artistsOf(nicheSlug: string): Artist[]
  nichesOfArtist(artistSlug: string): string[]
  brandsOf(nicheSlug: string): Brand[]
  communitiesOf(nicheSlug: string): Community[]
  tagsOf(nicheSlug: string): Tag[]
  tag(slug: string): Tag | undefined
  artist(slug: string): Artist | undefined
  brand(slug: string): Brand | undefined
  creator(slug: string): Creator | undefined
  /** Verified creators of a niche (creator_of edges). */
  creatorsOf(nicheSlug: string): Creator[]
  allCreators(): Creator[]
  allBrands(): Brand[]
  /** Niches a brand belongs to (brand_of edges; tags excluded). */
  nichesOfBrand(brandSlug: string): string[]
  /** Directly connected niches (not parents/children), labeled by relationship. */
  adjacent(nicheSlug: string): Adjacent[]
  /** Less obvious niches two hops away, best first. Never direct neighbours. */
  recommend(nicheSlug: string, limit?: number): string[]
  /** Featured niche slugs in featuredOrder. */
  featured(): string[]
}

interface BuildInput {
  profiles: readonly ProfileRef[]
  files: TaxonomyFiles
}

/** Collects every problem instead of failing on the first, so one run shows them all. */
export function validateTaxonomy({ profiles, files }: BuildInput): string[] {
  const problems: string[] = []
  const nodes = collectNodes(profiles, files, problems)

  const keysByType = new Map<string, string>()
  for (const node of nodes.values()) {
    for (const text of [node.slug, node.name, ...node.aliases]) {
      const key = `${node.type}:${lookupKey(text)}`
      const owner = keysByType.get(key)
      if (owner && owner !== node.slug) {
        problems.push(`${node.type} "${text}" (${node.slug}) collides with ${owner}`)
      }
      keysByType.set(key, node.slug)
    }
  }

  for (const curation of files.niches) {
    if (nodes.get(curation.slug)?.type !== "niche") {
      problems.push(`curation for unknown niche "${curation.slug}"`)
    }
  }
  const orders = files.niches.flatMap((n) => (n.featuredOrder ? [n.featuredOrder] : []))
  if (new Set(orders).size !== orders.length) problems.push("duplicate featuredOrder values")

  const edges = explicitEdges(files)
  const seen = new Set<string>()
  for (const edge of edges) {
    const from = nodes.get(edge.from)
    const to = nodes.get(edge.to)
    if (!from) problems.push(`${edge.type} edge from unknown node "${edge.from}"`)
    if (!to) problems.push(`${edge.type} edge to unknown node "${edge.to}"`)
    if (edge.from === edge.to) problems.push(`self-loop ${edge.type} on "${edge.from}"`)
    if (from && to) {
      const allowed = EDGE_ENDPOINTS[edge.type]
      if (!allowed.from.includes(from.type) || !allowed.to.includes(to.type)) {
        problems.push(
          `${edge.type} cannot connect ${from.type} → ${to.type} (${edge.from} → ${edge.to})`,
        )
      }
    }
    const key = edgeKey(edge)
    if (seen.has(key)) problems.push(`duplicate edge ${edge.from} ${edge.type} ${edge.to}`)
    seen.add(key)
  }

  const cycle = findParentCycle(edges.filter((edge) => edge.type === "parent"))
  if (cycle) problems.push(`parent cycle: ${cycle.join(" → ")}`)
  return problems
}

export function buildTaxonomy(input: BuildInput): Taxonomy {
  const problems = validateTaxonomy(input)
  if (problems.length > 0) throw new TaxonomyError(problems)
  const { profiles, files } = input
  const nodes = collectNodes(profiles, files, [])

  const keyIndex = new Map<string, string[]>()
  for (const node of nodes.values()) {
    for (const text of [node.slug, node.name, ...node.aliases]) {
      const key = lookupKey(text)
      const owners = keyIndex.get(key) ?? []
      if (!owners.includes(node.slug)) keyIndex.set(key, [...owners, node.slug])
    }
  }
  const resolve = (text: string, type?: NodeType): string | undefined =>
    keyIndex.get(lookupKey(text))?.find((slug) => !type || nodes.get(slug)?.type === type)

  const edges = [...explicitEdges(files), ...profileEdges(profiles, files, resolve)]
  const outgoing = groupBy(edges, (edge) => edge.from)
  const incoming = groupBy(edges, (edge) => edge.to)
  const out = (slug: string, type: EdgeType) =>
    (outgoing.get(slug) ?? []).filter((e) => e.type === type).map((e) => e.to)
  const into = (slug: string, type: EdgeType) =>
    (incoming.get(slug) ?? []).filter((e) => e.type === type).map((e) => e.from)

  const curations = new Map(files.niches.map((c) => [c.slug, c]))
  const artists = new Map(files.artists.map((a) => [a.slug, a]))
  const brands = new Map(files.brands.map((b) => [b.slug, b]))
  const communities = new Map(files.communities.map((c) => [c.slug, c]))
  const creators = new Map(files.creators.map((c) => [c.slug, c]))
  const tags = new Map(files.tags.map((t) => [t.slug, t]))
  const isNiche = (slug: string) => nodes.get(slug)?.type === "niche"

  /** Niche ↔ niche links in both directions, with the edge that made them. */
  function nicheLinks(slug: string): { slug: string; type: EdgeType; outbound: boolean }[] {
    const links = [
      ...(outgoing.get(slug) ?? []).map((e) => ({ slug: e.to, type: e.type, outbound: true })),
      ...(incoming.get(slug) ?? []).map((e) => ({ slug: e.from, type: e.type, outbound: false })),
    ]
    return links.filter((link) => isNiche(link.slug) && NICHE_EDGE_WEIGHT[link.type] > 0)
  }

  /** Entities (artists, brands, communities, tags) attached to a niche. */
  function entitiesOf(slug: string): string[] {
    return [
      ...into(slug, "artist_of"),
      ...into(slug, "brand_of"),
      ...into(slug, "community_of"),
      ...out(slug, "tagged"),
    ]
  }
  function nichesOfEntity(entity: string): string[] {
    const type = nodes.get(entity)?.type
    return type === "tag" ? into(entity, "tagged") : (outgoing.get(entity) ?? []).map((e) => e.to)
  }

  function adjacent(slug: string): Adjacent[] {
    const seen = new Set<string>()
    const result: Adjacent[] = []
    for (const link of nicheLinks(slug)) {
      if (link.type === "parent" || seen.has(link.slug)) continue
      seen.add(link.slug)
      result.push({ slug: link.slug, label: labelFor(link.type, link.outbound) })
    }
    return result.sort(
      (a, b) => ADJACENCY_ORDER.indexOf(a.label) - ADJACENCY_ORDER.indexOf(b.label),
    )
  }

  function recommend(slug: string, limit = 6): string[] {
    if (!isNiche(slug)) return []
    const direct = new Set([slug, ...nicheLinks(slug).map((link) => link.slug)])
    const scores = new Map<string, number>()
    const add = (target: string, score: number) => {
      if (!direct.has(target) && isNiche(target)) {
        scores.set(target, (scores.get(target) ?? 0) + score)
      }
    }
    for (const first of nicheLinks(slug)) {
      for (const second of nicheLinks(first.slug)) {
        add(second.slug, NICHE_EDGE_WEIGHT[first.type] * NICHE_EDGE_WEIGHT[second.type])
      }
    }
    for (const entity of entitiesOf(slug)) {
      const type = nodes.get(entity)?.type
      const weight = (type && ENTITY_WEIGHT[type]) ?? 0
      const reach = nichesOfEntity(entity)
      for (const target of reach) add(target, weight / Math.sqrt(reach.length))
    }
    return [...scores]
      .filter(([, score]) => score >= MIN_RECOMMENDATION_SCORE)
      .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
      .slice(0, limit)
      .map(([target]) => target)
  }

  function branchOf(slug: string): string | undefined {
    const queue = into(slug, "parent")
    const visited = new Set<string>()
    while (queue.length > 0) {
      const next = queue.shift() as string
      if (visited.has(next)) continue
      visited.add(next)
      if (nodes.get(next)?.type === "hub") return next
      queue.push(...into(next, "parent"))
    }
    return undefined
  }

  return {
    edges,
    hubs: files.hubs,
    node: (slug) => nodes.get(slug),
    resolve,
    curation: (slug) => curations.get(slug),
    children: (slug) => out(slug, "parent"),
    parents: (slug) => into(slug, "parent"),
    branchOf,
    artistsOf: (slug) => pick(into(slug, "artist_of"), artists),
    nichesOfArtist: (slug) => out(slug, "artist_of"),
    brandsOf: (slug) => pick(into(slug, "brand_of"), brands),
    communitiesOf: (slug) => pick(into(slug, "community_of"), communities),
    tagsOf: (slug) => pick(out(slug, "tagged"), tags),
    tag: (slug) => tags.get(slug),
    artist: (slug) => artists.get(slug),
    brand: (slug) => brands.get(slug),
    creator: (slug) => creators.get(slug),
    creatorsOf: (slug) => pick(into(slug, "creator_of"), creators),
    allCreators: () => [...creators.values()],
    allBrands: () => [...brands.values()],
    nichesOfBrand: (slug) => out(slug, "brand_of").filter(isNiche),
    adjacent,
    recommend,
    featured: () =>
      files.niches
        .filter((c) => c.featuredOrder !== undefined)
        .sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0))
        .map((c) => c.slug),
  }
}

function labelFor(type: EdgeType, outbound: boolean): AdjacencyLabel {
  switch (type) {
    case "similar_scene":
      return "Same scene"
    case "overlapping_aesthetic":
      return "Same aesthetic"
    // A fashion niche points at the sound it dresses; seen from the music side it's the fit.
    case "fashion_of":
      return outbound ? "The sound" : "The fit"
    default:
      return "Related"
  }
}

function collectNodes(
  profiles: readonly ProfileRef[],
  files: TaxonomyFiles,
  problems: string[],
): Map<string, GraphNode> {
  const nodes = new Map<string, GraphNode>()
  const curations = new Map(files.niches.map((c) => [c.slug, c]))
  const add = (node: GraphNode) => {
    const existing = nodes.get(node.slug)
    if (existing)
      problems.push(`slug "${node.slug}" used by both ${existing.type} and ${node.type}`)
    else nodes.set(node.slug, node)
  }
  for (const hub of files.hubs) add({ ...hub, type: "hub" })
  for (const profile of profiles) {
    add({
      slug: profile.slug,
      type: "niche",
      name: profile.name,
      aliases: curations.get(profile.slug)?.aliases ?? [],
    })
  }
  for (const tag of files.tags) add({ ...tag, type: "tag" })
  for (const artist of files.artists) add({ ...artist, type: "artist" })
  for (const brand of files.brands) add({ ...brand, type: "brand" })
  for (const community of files.communities) add({ ...community, type: community.type })
  for (const creator of files.creators) add({ ...creator, type: "creator" })
  return nodes
}

/** Edges written in the JSON, plus the ones implied by hub children and entity niche lists. */
function explicitEdges(files: TaxonomyFiles): Edge[] {
  return [
    ...files.hubs.flatMap((hub) =>
      hub.children.map((child): Edge => ({ from: hub.slug, type: "parent", to: child })),
    ),
    ...files.edges,
    ...files.tags.flatMap((tag) =>
      tag.niches.map((niche): Edge => ({ from: niche, type: "tagged", to: tag.slug })),
    ),
    ...files.brands.flatMap((brand) =>
      brand.linkedTo.map((target): Edge => ({ from: brand.slug, type: "brand_of", to: target })),
    ),
    ...files.creators.flatMap((creator) =>
      creator.niches.map((niche): Edge => ({ from: creator.slug, type: "creator_of", to: niche })),
    ),
    ...files.communities.flatMap((community) =>
      community.niches.map((niche): Edge => ({
        from: community.slug,
        type: "community_of",
        to: niche,
      })),
    ),
  ]
}

/**
 * Edges implied by niche profiles: a verified artist named in a profile is
 * `artist_of` it, and a resolvable relatedNiches name becomes `related`
 * (unless a more specific edge already links the pair).
 */
function profileEdges(
  profiles: readonly ProfileRef[],
  files: TaxonomyFiles,
  resolve: (text: string, type?: NodeType) => string | undefined,
): Edge[] {
  const linked = new Set(
    explicitEdges(files)
      .filter((edge) => edge.type !== "tagged")
      .map((edge) => pairKey(edge.from, edge.to)),
  )
  const edges: Edge[] = []
  const soundtrackOnly = new Set(
    files.niches.filter((niche) => niche.soundtrackOnly).map((niche) => niche.slug),
  )
  for (const profile of profiles) {
    // Some niches' artists are a mood, not the scene (Laufey isn't softmaxxing).
    const artists = soundtrackOnly.has(profile.slug) ? [] : profile.artists
    for (const { name } of artists) {
      const artist = resolve(name, "artist")
      if (artist && !linked.has(pairKey(artist, profile.slug))) {
        linked.add(pairKey(artist, profile.slug))
        edges.push({ from: artist, type: "artist_of", to: profile.slug })
      }
    }
    for (const name of profile.relatedNiches) {
      const niche = resolve(name, "niche")
      if (niche && niche !== profile.slug && !linked.has(pairKey(niche, profile.slug))) {
        linked.add(pairKey(niche, profile.slug))
        edges.push({ from: profile.slug, type: "related", to: niche })
      }
    }
  }
  return edges
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

function edgeKey(edge: Edge): string {
  return SYMMETRIC_EDGE_TYPES.has(edge.type)
    ? `${edge.type}:${pairKey(edge.from, edge.to)}`
    : `${edge.type}:${edge.from}>${edge.to}`
}

function findParentCycle(edges: readonly Edge[]): string[] | null {
  const children = groupBy(edges, (edge) => edge.from)
  const state = new Map<string, "visiting" | "done">()
  const path: string[] = []
  const visit = (slug: string): string[] | null => {
    if (state.get(slug) === "done") return null
    if (state.get(slug) === "visiting") return [...path.slice(path.indexOf(slug)), slug]
    state.set(slug, "visiting")
    path.push(slug)
    for (const edge of children.get(slug) ?? []) {
      const cycle = visit(edge.to)
      if (cycle) return cycle
    }
    path.pop()
    state.set(slug, "done")
    return null
  }
  for (const slug of children.keys()) {
    const cycle = visit(slug)
    if (cycle) return cycle
  }
  return null
}

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item])
  return map
}

function pick<T>(slugs: readonly string[], from: ReadonlyMap<string, T>): T[] {
  return slugs.flatMap((slug) => {
    const value = from.get(slug)
    return value ? [value] : []
  })
}
