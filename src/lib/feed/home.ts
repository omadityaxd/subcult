import "server-only"
import { TAXONOMY, nicheImage } from "@/lib/niches/catalog"
import { type OrderedNiche, personalNicheOrder } from "@/lib/taste/rank"
import { lookupNicheProfile } from "@/lib/niches/lookup"
import { featuredOrder, type HomeNiche } from "./featured"
import { appFeedDeps } from "./app-deps"
import { type NicheFeed, buildNicheFeed } from "./feed"
import { soundtrackFeedItems } from "@/lib/music/soundtrack"
import { getSoundtrack } from "@/lib/music/soundtrack-server"
import { buildForYou } from "./for-you"
import { STORY_FRAMES, storyFrames } from "./story-mix"
import { moodboardFeedItems } from "@/lib/moodboard/board"
import { getMoodboard } from "@/lib/moodboard/server"
import { archiveFeedItems, getArchive } from "@/lib/shop/server"
import { fitFeedItems, nicheFits } from "@/lib/fits/server"
import type { FeedItem } from "./types"

export interface HomePage {
  niche: HomeNiche
  items: FeedItem[]
  nextCursor: number | null
  /** Why this niche is on this person's feed (taste, exploration, or today's default). */
  why?: OrderedNiche["why"]
  /** Exploration pages: the person's niche this one is two hops from. */
  from?: string
}

/**
 * Today's page order, personal when the client sends its top niche
 * affinities (niche slug → score). The order is computed fresh per request
 * from the same inputs, so a cursor stays stable for a session.
 */
export function homeOrder(now: Date, taste: ReadonlyMap<string, number> | null): OrderedNiche[] {
  const base = featuredOrder(now).map((niche) => niche.slug)
  return taste && taste.size > 0
    ? personalNicheOrder(base, taste, (slug) => TAXONOMY.recommend(slug))
    : base.map((slug) => ({ slug, why: "default" }))
}

const ITEMS_PER_NICHE = 8

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
  taste: ReadonlyMap<string, number> | null = null,
): Promise<HomePage | null> {
  const order = homeOrder(now, taste)
  const placed = order[cursor]
  const target = placed ? featuredOrder(now).find((niche) => niche.slug === placed.slug) : null
  if (!placed || !target) return null
  const placement = { why: placed.why, ...(placed.from ? { from: placed.from } : {}) }
  const [result, soundtrack, board, archives, fits] = await Promise.all([
    feedFor(target.slug),
    getSoundtrack(target.slug),
    getMoodboard(target.slug),
    getArchive(target.slug),
    nicheFits(target.slug, 6),
  ])
  const nextCursor = cursor + 1 < order.length ? cursor + 1 : null
  if (!result) return { niche: target, items: [], nextCursor, ...placement }
  return {
    ...placement,
    niche: result.niche,
    items: buildForYou(
      target.slug,
      result.feed,
      {
        music: soundtrack ? soundtrackFeedItems(soundtrack) : [],
        moodboard: moodboardFeedItems(board.pins),
        fashion: [...fitFeedItems(fits), ...archiveFeedItems(archives ?? [])],
      },
      ITEMS_PER_NICHE,
    ),
    nextCursor,
  }
}

/** Story frames for one niche: Fit, Tea and Grail when it has them, at most 2 Sound, a poll. */
export async function getStory(
  slug: string,
): Promise<{ niche: HomeNiche; items: FeedItem[] } | null> {
  const result = await feedFor(slug)
  if (!result) return null
  return { niche: result.niche, items: storyFrames(result.items, STORY_FRAMES) }
}
