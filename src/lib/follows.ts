import type { SavedItem } from "@/lib/saves"

/** Followed niches are saves with a `niche:` id, so they ride the same store and migration. */
export const FOLLOW_SOURCE = "niche"

export const followId = (slug: string): string => `niche:${slug}`

export function followItem(niche: {
  slug: string
  name: string
  tagline: string
  imageUrl: string | null
}): Omit<SavedItem, "savedAt"> {
  return {
    id: followId(niche.slug),
    title: niche.name,
    url: `/n/${niche.slug}`,
    imageUrl: niche.imageUrl,
    source: FOLLOW_SOURCE,
    subtitle: niche.tagline,
  }
}

export const isFollow = (item: Pick<SavedItem, "source">): boolean => item.source === FOLLOW_SOURCE
