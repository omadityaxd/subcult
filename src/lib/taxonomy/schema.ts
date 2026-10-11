import { z } from "zod"
import { MIX_KINDS as MIX_KIND_IDS } from "@/lib/feed/mix"
import { EXTRA_STORE_IDS } from "@/lib/links"

/**
 * The subculture graph, authored as JSON in /data/taxonomy and validated here.
 * Niches keep their full profiles in /data/niches; this layer adds the typed
 * entities around them (hubs, tags, artists, brands, collectives, identities)
 * and the typed relationships between everything.
 */

export const NODE_TYPES = [
  "hub",
  "niche",
  "tag",
  "artist",
  "brand",
  "collective",
  "identity",
] as const
export type NodeType = (typeof NODE_TYPES)[number]

/**
 * Directed edge types, stored once in their canonical direction.
 * - parent: hub|niche → hub|niche (the inverse, "child", is derived)
 * - related / similar_scene / overlapping_aesthetic: niche ↔ niche (symmetric)
 * - fashion_of: fashion niche → the music niche or scene it dresses
 * - artist_of: artist → niche; brand_of: brand → niche or tag
 * - community_of: collective|identity → niche
 * - tagged: niche → tag
 */
export const EDGE_TYPES = [
  "parent",
  "related",
  "similar_scene",
  "overlapping_aesthetic",
  "fashion_of",
  "artist_of",
  "brand_of",
  "community_of",
  "tagged",
] as const
export type EdgeType = (typeof EDGE_TYPES)[number]

export const SYMMETRIC_EDGE_TYPES: ReadonlySet<EdgeType> = new Set([
  "related",
  "similar_scene",
  "overlapping_aesthetic",
])

/** Which node types each edge type may connect (from → to). */
export const EDGE_ENDPOINTS: Record<
  EdgeType,
  { from: readonly NodeType[]; to: readonly NodeType[] }
> = {
  parent: { from: ["hub", "niche"], to: ["hub", "niche"] },
  related: { from: ["niche"], to: ["niche"] },
  similar_scene: { from: ["niche"], to: ["niche"] },
  overlapping_aesthetic: { from: ["niche"], to: ["niche"] },
  fashion_of: { from: ["niche"], to: ["niche"] },
  artist_of: { from: ["artist"], to: ["niche"] },
  brand_of: { from: ["brand"], to: ["niche", "tag"] },
  community_of: { from: ["collective", "identity"], to: ["niche"] },
  tagged: { from: ["niche"], to: ["tag"] },
}

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "kebab-case slug")
const aliases = z.array(z.string().min(1).max(60)).default([])
const description = z.string().min(10).max(400)
const SPOTIFY_ID = /^[0-9A-Za-z]{22}$/

export const hubSchema = z.object({
  slug,
  name: z.string().min(1).max(60),
  description,
  aliases,
  /** Hubs and niches beneath this hub, in display order. */
  children: z.array(slug).min(1),
})

export const nicheCurationSchema = z.object({
  slug,
  aliases,
  /** Lower comes first in For You stories and on Explore. Omit for non-featured. */
  featuredOrder: z.number().int().min(1).optional(),
  extraStores: z.array(z.enum(EXTRA_STORE_IDS)).default([]),
  /** Per-niche content-mix override (shares by kind; normalized with the defaults). */
  mix: z.record(z.enum(MIX_KIND_IDS), z.number().min(0).max(1)).optional(),
  /** Phrases that disqualify a news/video item for this niche ("opium war", "type beat"). */
  negativeKeywords: z.array(z.string().min(2).max(40)).default([]),
  /** Public Are.na channel slugs for the moodboard (checked readable without a key). */
  arenaChannels: z.array(z.string().regex(/^[a-z0-9-]+$/)).default([]),
  /** ISO 639-1 languages the niche's content is in; anything else is dropped. */
  languages: z.array(z.string().regex(/^[a-z]{2}$/)).default(["en"]),
})

export const edgeSchema = z.object({
  from: slug,
  type: z.enum(EDGE_TYPES),
  to: slug,
})

export const TAG_GROUPS = ["fit-pics", "grails", "drops", "silhouettes", "scene"] as const

export const tagSchema = z.object({
  slug,
  name: z.string().min(1).max(60),
  group: z.enum(TAG_GROUPS),
  aliases,
  description,
  /** Lowercase phrases matched against feed item titles to label them. */
  keywords: z.array(z.string().min(2).max(40)).min(1),
  niches: z.array(slug).min(1),
})

/** Written by `pnpm taxonomy:verify-artists`; never hand-edited. */
export const artistSchema = z.object({
  slug,
  name: z.string().min(1).max(80),
  aliases,
  spotifyId: z.string().regex(SPOTIFY_ID),
  imageUrl: z.string().url().nullable(),
})

export const brandSchema = z.object({
  slug,
  name: z.string().min(1).max(60),
  aliases,
  description,
  /** Verified official site only. Null when there's no site we can stand behind. */
  officialUrl: z.string().url().nullable(),
  /** Niches and tags this brand belongs to. */
  linkedTo: z.array(slug).min(1),
})

export const communitySchema = z.object({
  slug,
  type: z.enum(["collective", "identity"]),
  name: z.string().min(1).max(60),
  aliases,
  description,
  /** Where the meaning was verified. */
  sources: z.array(z.string().url()).min(1),
  niches: z.array(slug).min(1),
})

export const taxonomyFilesSchema = z.object({
  hubs: z.array(hubSchema),
  niches: z.array(nicheCurationSchema),
  edges: z.array(edgeSchema),
  tags: z.array(tagSchema),
  artists: z.array(artistSchema),
  brands: z.array(brandSchema),
  communities: z.array(communitySchema),
})

export type Hub = z.infer<typeof hubSchema>
export type NicheCuration = z.infer<typeof nicheCurationSchema>
export type EdgeInput = z.infer<typeof edgeSchema>
export type Tag = z.infer<typeof tagSchema>
export type TagGroup = (typeof TAG_GROUPS)[number]
export type Artist = z.infer<typeof artistSchema>
export type Brand = z.infer<typeof brandSchema>
export type Community = z.infer<typeof communitySchema>
export type TaxonomyFiles = z.infer<typeof taxonomyFilesSchema>
