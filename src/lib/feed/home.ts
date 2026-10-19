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
import { dedupeImages, withImageFacts } from "@/lib/images/curate"
import { imageFactsFor } from "@/lib/images/facts-server"

const STORY_MEASURED = 40
const STORY_BUDGET_MS = 1500
import { moodboardFeedItems } from "@/lib/moodboard/board"
import { getMoodboard } from "@/lib/moodboard/server"
import { archiveFeedItems, getArchive } from "@/lib/shop/server"
import { fitFeedItems, nicheFits } from "@/lib/fits/server"
import type { FeedItem } from "./types"
import { dedupeMusic } from "./dedupe-music"

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
  // One story never shows the same artwork twice (a track and its album, two sizes of one photo).
  const facts = await imageFactsFor(
    result.items.map((item) => item.imageUrl).slice(0, STORY_MEASURED),
    STORY_BUDGET_MS,
  )
  const unique = dedupeImages(dedupeMusic(result.items), (item) => item.imageUrl, facts).map(
    (item) => withImageFacts(item, facts),
  )
  return { niche: result.niche, items: storyFrames(unique, STORY_FRAMES) }
}
