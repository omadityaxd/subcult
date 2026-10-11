import "server-only"
import { nicheImage } from "@/lib/niches/catalog"
import { lookupNicheProfile } from "@/lib/niches/lookup"
import { featuredOrder, type HomeNiche } from "./featured"
import { appFeedDeps } from "./app-deps"
import { type NicheFeed, buildNicheFeed } from "./feed"
import { soundtrackFeedItems } from "@/lib/music/soundtrack"
import { getSoundtrack } from "@/lib/music/soundtrack-server"
import { buildForYou } from "./for-you"
import { storyOrder } from "./video-cap"
import { moodboardFeedItems } from "@/lib/moodboard/board"
import { getMoodboard } from "@/lib/moodboard/server"
import { archiveFeedItems, getArchive } from "@/lib/shop/server"
import type { FeedItem } from "./types"

export interface HomePage {
  niche: HomeNiche
  items: FeedItem[]
  nextCursor: number | null
}

const ITEMS_PER_NICHE = 8
const STORY_ITEMS = 10

async function feedFor(
  slug: string,
): Promise<{ niche: HomeNiche; items: FeedItem[]; feed: NicheFeed } | null> {
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
    feed,
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
  const [result, soundtrack, board, archives] = await Promise.all([
    feedFor(target.slug),
    getSoundtrack(target.slug),
    getMoodboard(target.slug),
    getArchive(target.slug),
  ])
  const nextCursor = cursor + 1 < order.length ? cursor + 1 : null
  if (!result) return { niche: target, items: [], nextCursor }
  return {
    niche: result.niche,
    items: buildForYou(
      target.slug,
      result.feed,
      {
        music: soundtrack ? soundtrackFeedItems(soundtrack) : [],
        moodboard: moodboardFeedItems(board.pins),
        fashion: archiveFeedItems(archives ?? []),
      },
      ITEMS_PER_NICHE,
    ),
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
