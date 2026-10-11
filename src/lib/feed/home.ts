import "server-only"
import { nicheImage } from "@/lib/niches/catalog"
import { lookupNicheProfile } from "@/lib/niches/lookup"
import { buildNicheFeed } from "./feed"
import { featuredOrder, type HomeNiche } from "./featured"
import { appFeedDeps } from "./app-deps"
import { capVideos, storyOrder } from "./video-cap"
import type { FeedItem } from "./types"

export interface HomePage {
  niche: HomeNiche
  items: FeedItem[]
  nextCursor: number | null
}

const ITEMS_PER_NICHE = 8
const STORY_ITEMS = 10

async function feedFor(slug: string): Promise<{ niche: HomeNiche; items: FeedItem[] } | null> {
  const lookup = await lookupNicheProfile(slug)
  if (lookup.status !== "found") return null
  const { profile } = lookup
  const feed = await buildNicheFeed(profile, appFeedDeps())
  return {
    niche: {
      slug: profile.slug,
      name: profile.name,
      tagline: profile.tagline,
      palette: profile.palette,
      imageUrl: nicheImage(profile.slug),
    },
    items: feed.items,
  }
}

/** One page of the infinite home feed = the top items of the next niche in today's order. */
export async function getHomePage(
  cursor: number,
  now: Date = new Date(),
): Promise<HomePage | null> {
  const order = featuredOrder(now)
  const target = order[cursor]
  if (!target) return null
  const result = await feedFor(target.slug)
  const nextCursor = cursor + 1 < order.length ? cursor + 1 : null
  if (!result) return { niche: target, items: [], nextCursor }
  return {
    niche: result.niche,
    items: capVideos(result.items, undefined, ITEMS_PER_NICHE),
    nextCursor,
  }
}

/** Story frames for one niche: music first, other visuals, then headlines; video capped. */
export async function getStory(
  slug: string,
): Promise<{ niche: HomeNiche; items: FeedItem[] } | null> {
  const result = await feedFor(slug)
  if (!result) return null
  return { niche: result.niche, items: storyOrder(result.items, STORY_ITEMS) }
}
