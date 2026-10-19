import "server-only"
import type { FeedItem } from "@/lib/feed/types"
import { errorMessage, log } from "@/lib/log"
import { moodboardFeedItems } from "@/lib/moodboard/board"
import { getMoodboard } from "@/lib/moodboard/server"
import { soundtrackFeedItems } from "@/lib/music/soundtrack"
import { getSoundtrack } from "@/lib/music/soundtrack-server"
import { TAXONOMY, findSeedProfile, nicheImage } from "@/lib/niches/catalog"
import { formatPrice } from "@/lib/shop/archive"
import { archiveFeedItems, getArchive } from "@/lib/shop/server"
import { VIBE_LINES, type DeckCard, deckCards } from "./data"
import { seededRandom } from "./adaptive"
import { type LiveCandidate, assemblePool } from "./pool"

/** Niches sampled for live cards per session (their content is cached, but not free). */
const LIVE_NICHES = 10
/** Past this, a niche's live cards are skipped: the deck never waits on a slow source. */
const BUDGET_MS = 2500
const PER_KIND = 3
const FALLBACK_PALETTE = ["#0a0a0a", "#222222", "#555555", "#aaaaaa", "#f2f2f2"]

const str = (value: unknown) => (typeof value === "string" && value ? value : null)

function withinBudget<T>(work: Promise<T[]>): Promise<T[]> {
  return Promise.race([
    work,
    new Promise<T[]>((resolve) => setTimeout(() => resolve([]), BUDGET_MS)),
  ])
}

function fromItem(
  niche: string,
  kind: LiveCandidate["kind"],
  item: FeedItem,
  label: string | null,
): LiveCandidate[] {
  return item.imageUrl
    ? [
        {
          niche,
          kind,
          id: item.id,
          imageUrl: item.imageUrl,
          label,
          previewUrl: str(item.meta.previewUrl),
          crop: item.meta.short === true,
        },
      ]
    : []
}

/** Today's real fits, grails, pins and sounds for one niche. */
async function liveFor(slug: string): Promise<LiveCandidate[]> {
  const [board, archive, soundtrack] = await Promise.all([
    getMoodboard(slug).catch(() => null),
    getArchive(slug).catch(() => null),
    getSoundtrack(slug).catch(() => null),
  ])
  const pins = board ? moodboardFeedItems(board.pins) : []
  const fits = pins
    .filter((item) => item.meta.fit === true)
    .slice(0, PER_KIND)
    .flatMap((item) =>
      fromItem(
        slug,
        "fit",
        item,
        str(item.meta.seenOn) ? `Seen on ${str(item.meta.seenOn)}` : str(item.meta.wearingName),
      ),
    )
  const moodboard = pins
    .filter((item) => item.meta.fit !== true && item.source !== "subcult")
    .slice(0, PER_KIND)
    .flatMap((item) => fromItem(slug, "pin", item, item.subtitle))
  const grails = archiveFeedItems(archive ?? [])
    .slice(0, PER_KIND)
    .flatMap((item) =>
      fromItem(
        slug,
        "grail",
        item,
        [
          item.subtitle,
          typeof item.meta.price === "number"
            ? formatPrice(item.meta.price, str(item.meta.currency) ?? "USD")
            : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
      ),
    )
  const sounds = (soundtrack ? soundtrackFeedItems(soundtrack) : [])
    .filter((item) => str(item.meta.previewUrl))
    .slice(0, PER_KIND)
    .flatMap((item) =>
      fromItem(slug, "sound", item, [item.title, item.subtitle].filter(Boolean).join(" · ")),
    )
  return [...fits, ...moodboard, ...grails, ...sounds]
}

function sample<T>(items: readonly T[], n: number, random: () => number): T[] {
  return [...items]
    .map((item) => ({ item, key: random() }))
    .sort((a, b) => a.key - b.key)
    .slice(0, n)
    .map(({ item }) => item)
}

/**
 * This session's deck pool: classic cards, every featured niche's
 * one-liner, and live cards from a random sample of niches' content today.
 */
export async function vibePool(random: () => number = Math.random): Promise<DeckCard[]> {
  const niches = sample(TAXONOMY.featured(), LIVE_NICHES, random)
  const live = (
    await Promise.all(
      niches.map((slug) =>
        withinBudget(liveFor(slug)).catch((error: unknown) => {
          log.warn("vibe.live_failed", { slug, error: errorMessage(error) })
          return []
        }),
      ),
    )
  ).flat()
  return assemblePool(
    {
      classic: deckCards(),
      lines: VIBE_LINES,
      live,
      adjacent: (slug) => TAXONOMY.adjacent(slug).map((a) => a.slug),
      palette: (slug) => findSeedProfile(slug)?.palette ?? FALLBACK_PALETTE,
      nicheImage,
    },
    random,
  )
}

/** A vibe-check session: today's pool and the seed the deck's choices follow. */
export async function vibeSession(): Promise<{ cards: DeckCard[]; seed: number }> {
  const seed = Math.floor(Math.random() * 2 ** 31)
  return { cards: await vibePool(seededRandom(seed)), seed }
}
