import { toNicheSlug } from "@/lib/engine/slug"
import type { FeedItem } from "@/lib/feed/types"

/**
 * The things taste is about: verified artists, brands, niches and tags,
 * referenced as "type:slug". The taxonomy stays curated; only how much each
 * person cares about each entity is learned.
 */
export const ENTITY_TYPES = ["artist", "brand", "niche", "tag"] as const
export type EntityType = (typeof ENTITY_TYPES)[number]
export type EntityRef = `${EntityType}:${string}`

const REF = /^(artist|brand|niche|tag):[a-z0-9]+(?:-[a-z0-9]+)*$/

export const isEntityRef = (value: string): value is EntityRef => REF.test(value)

export function entityRef(type: EntityType, slug: string): EntityRef | null {
  const ref = `${type}:${slug}`
  return isEntityRef(ref) ? ref : null
}

export function entityType(ref: EntityRef): EntityType {
  return ref.slice(0, ref.indexOf(":")) as EntityType
}

export const entitySlug = (ref: EntityRef): string => ref.slice(ref.indexOf(":") + 1)

/** Separators in a track credit: commas, "&", "feat.", "ft.", " x ", "with". */
const CREDIT_SPLIT = /,|&|\bfeat\.?|\bft\.?|\bx\b|\bwith\b/i

/** A track credit ("evilgiane, xaviersobased & Nettspend feat. X") → one artist per name. */
export function labeledArtistsFromCredit(credit: string): LabeledEntity[] {
  return credit
    .split(CREDIT_SPLIT)
    .map((name) => name.trim())
    .filter(Boolean)
    .flatMap((name) => {
      const ref = entityRef("artist", toNicheSlug(name))
      return ref ? [{ ref, label: name }] : []
    })
}

export const artistRefsFromCredit = (credit: string): EntityRef[] =>
  labeledArtistsFromCredit(credit).map(({ ref }) => ref)

export interface LabeledEntity {
  ref: EntityRef
  label: string
}

const cleanLabel = (label: string) => label.replace(/[,=]/g, " ").trim().slice(0, 80)

/** Encoded on FeedItem.meta.entities as "artist:x=Name,niche:y=name" (meta holds primitives only). */
export function encodeEntities(entities: readonly (LabeledEntity | EntityRef)[]): string {
  const seen = new Set<string>()
  return entities
    .map((entity) => (typeof entity === "string" ? { ref: entity, label: "" } : entity))
    .filter(({ ref }) => !seen.has(ref) && seen.add(ref))
    .map(({ ref, label }) => (label ? `${ref}=${cleanLabel(label)}` : ref))
    .join(",")
}

export function decodeLabeled(value: unknown): LabeledEntity[] {
  if (typeof value !== "string" || !value) return []
  return value.split(",").flatMap((part) => {
    const [ref, label] = part.split("=")
    return isEntityRef(ref) ? [{ ref, label: label || humanize(ref) }] : []
  })
}

export const decodeEntities = (value: unknown): EntityRef[] =>
  decodeLabeled(value).map(({ ref }) => ref)

/** Fallback display name from a slug: "rick-owens" → "rick owens". */
export const humanize = (ref: EntityRef): string => entitySlug(ref).replace(/-/g, " ")

const str = (value: unknown) => (typeof value === "string" && value ? value : null)

/**
 * What a card is about, with display names: meta.entities first, then the
 * ids the card already holds (artist/brand cards, track credits, the page's niche).
 */
export function labeledEntitiesOfItem(
  item: FeedItem,
  niche: { slug: string; name: string } | null = null,
): LabeledEntity[] {
  const out = new Map<EntityRef, string>()
  const add = (ref: EntityRef | null, label: string) => {
    if (ref && !out.has(ref)) out.set(ref, label)
  }
  for (const { ref, label } of decodeLabeled(item.meta.entities)) add(ref, label)
  const artist = str(item.meta.artistSlug)
  const brand = str(item.meta.brandSlug)
  if (artist && item.type === "artist") add(entityRef("artist", artist), item.title)
  if (brand) add(entityRef("brand", brand), item.title)
  if (item.type === "track" && item.subtitle) {
    for (const { ref, label } of labeledArtistsFromCredit(item.subtitle)) add(ref, label)
  }
  if (item.type === "niche") add(entityRef("niche", item.url.replace(/^\/n\//, "")), item.title)
  if (niche) add(entityRef("niche", niche.slug), niche.name)
  for (const ref of entitiesOfItem(item)) add(ref, humanize(ref))
  return [...out].map(([ref, label]) => ({ ref, label }))
}

/**
 * What a card is about. Server-built cards carry meta.entities; older cached
 * items fall back to the ids they already hold. `niche` is the page the card
 * was shown in, so every card is at least about its niche.
 */
export function entitiesOfItem(item: FeedItem, niche: string | null = null): EntityRef[] {
  const refs = decodeEntities(item.meta.entities)
  const add = (ref: EntityRef | null) => {
    if (ref) refs.push(ref)
  }
  const artist = str(item.meta.artistSlug)
  const brand = str(item.meta.brandSlug)
  if (artist) add(entityRef("artist", artist))
  if (brand) add(entityRef("brand", brand))
  if (item.type === "track" && item.subtitle) refs.push(...artistRefsFromCredit(item.subtitle))
  if (item.type === "niche") add(entityRef("niche", item.url.replace(/^\/n\//, "")))
  for (const slug of [str(item.meta.nicheSlug), str(item.meta.niche), niche]) {
    if (slug) add(entityRef("niche", slug))
  }
  return [...new Set(refs)]
}
