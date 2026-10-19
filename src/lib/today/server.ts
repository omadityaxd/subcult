import "server-only"
import { featuredOrder } from "@/lib/feed/featured"
import { appFeedDeps } from "@/lib/feed/app-deps"
import { buildNicheFeed } from "@/lib/feed/feed"
import type { FeedItem } from "@/lib/feed/types"
import { fitFeedItems, nicheFits } from "@/lib/fits/server"
import { errorMessage, log } from "@/lib/log"
import { artistReleases } from "@/lib/music/releases-server"
import { soundtrackFeedItems } from "@/lib/music/soundtrack"
import { getSoundtrack } from "@/lib/music/soundtrack-server"
import { TAXONOMY, findPreset, findSeedProfile, nicheArtistsLeadFirst } from "@/lib/niches/catalog"
import { entityPhoto, withTeaImage } from "./tea-image"
import { moodboardFeedItems } from "@/lib/moodboard/board"
import { getMoodboard } from "@/lib/moodboard/server"
import { momentumReason } from "@/lib/rising/momentum"
import { pickRising } from "@/lib/rising/pick"
import { getRisingSnapshot } from "@/lib/rising/server"
import { friendsInto } from "@/lib/social/server"
import { archiveFeedItems, getArchive } from "@/lib/shop/server"
import { type EntityRef, encodeEntities, entitySlug, entityType } from "@/lib/taste/entities"
import {
  type Candidates,
  type FriendChip,
  type RisingChip,
  SECTION_CAPS,
  type TodayEdition,
  assembleEdition,
  localClock,
  todayMode,
} from "./edition"

const HOUR = 3600_000
const DAY = 24 * HOUR
const NICHES = 4
const ARTISTS = 6
const BRANDS = 6
const DROP_DAYS = 14
const HEADLINE_HOURS = 72
const DIGEST_HOURS = 24
const LISTING_DAYS = 7
const FIT_DAYS = 7
const MORE_VIDEOS = 2

export interface TodayRequest {
  /** Signed-in viewer (for the friends row); null for guests. */
  viewerId?: string | null
  /** The person's strongest entities (from their on-device taste vector). */
  entities: readonly { ref: EntityRef; score: number }[]
  /** Saved brand slugs: archive listings for these come first. */
  brands: readonly string[]
  lastVisit: number | null
  timeZone: string
}

const ageMs = (item: FeedItem, now: number) =>
  item.publishedAt ? now - Date.parse(item.publishedAt) : Number.POSITIVE_INFINITY

const strongest = (req: TodayRequest, type: ReturnType<typeof entityType>) =>
  req.entities
    .filter((e) => e.score > 0 && entityType(e.ref) === type)
    .sort((a, b) => b.score - a.score)
    .map((e) => entitySlug(e.ref))

function hrefFor(ref: EntityRef, niches: readonly string[]): string {
  const slug = entitySlug(ref)
  if (entityType(ref) === "niche") return `/n/${slug}`
  return `/n/${niches[0] ?? ""}`
}

async function drops(artists: readonly string[], now: number): Promise<FeedItem[]> {
  const lists = await Promise.all(
    artists.map(async (slug) => {
      const artist = TAXONOMY.artist(slug)
      if (!artist) return []
      const releases = await artistReleases(slug, artist.name)
      return releases
        .filter((r) => now - Date.parse(r.releasedAt) <= DROP_DAYS * DAY)
        .map((r): FeedItem => ({
          id: `subcult:release:${r.id}`,
          source: "subcult",
          type: "release",
          title: r.title,
          subtitle: r.artist,
          imageUrl: r.artworkUrl,
          url: r.appleUrl ?? "",
          publishedAt: r.releasedAt,
          score: 1,
          meta: {
            kind: r.kind,
            artistSlug: slug,
            entities: encodeEntities([{ ref: `artist:${slug}`, label: artist.name }]),
          },
        }))
    }),
  )
  return lists.flat()
}

async function nicheNews(niches: readonly string[]): Promise<FeedItem[]> {
  const feeds = await Promise.all(
    niches.map(async (slug) => {
      const profile = findSeedProfile(slug)
      if (!profile) return []
      const feed = await buildNicheFeed(profile, appFeedDeps()).catch(() => null)
      return feed?.bySource.news ?? []
    }),
  )
  // Round-robin across niches so one loud scene doesn't take every slot.
  const out: FeedItem[] = []
  const longest = Math.max(0, ...feeds.map((f) => f.length))
  for (let i = 0; i < longest; i++) for (const feed of feeds) if (feed[i]) out.push(feed[i])
  // Never text-only: a story without its own image borrows its niche's face, tinted.
  return out.map((item, index) => {
    const slug = String(item.meta.nicheSlug ?? "")
    const pictured = nicheArtistsLeadFirst(slug).filter((artist) => artist.imageUrl)
    return withTeaImage(item, {
      imageUrl: entityPhoto(item.title, pictured, index),
      palette: findPreset(slug)?.palette ?? null,
    })
  })
}

async function listings(
  niches: readonly string[],
  brands: ReadonlySet<string>,
  now: number,
): Promise<FeedItem[]> {
  const archives = await Promise.all(niches.map((slug) => getArchive(slug).catch(() => null)))
  const items = archives.flatMap((a) => archiveFeedItems(a ?? []))
  const fresh = items.filter((item) => ageMs(item, now) <= LISTING_DAYS * DAY)
  const yours = fresh.filter((item) => brands.has(String(item.meta.brandSlug)))
  // Your brands first; otherwise the scene's grails.
  return yours.length > 0 ? yours : fresh.filter((item) => item.meta.grail === true)
}

async function friendsRow(viewerId: string, now: number): Promise<FriendChip[]> {
  return (await friendsInto(viewerId, now)).flatMap((f) => {
    const ref = f.entity as EntityRef
    const niche =
      entityType(ref) === "niche"
        ? entitySlug(ref)
        : entityType(ref) === "artist"
          ? TAXONOMY.nichesOfArtist(entitySlug(ref))[0]
          : entityType(ref) === "brand"
            ? TAXONOMY.nichesOfBrand(entitySlug(ref))[0]
            : undefined
    return niche
      ? [{ entity: f.entity, label: f.label, handles: f.handles, href: `/n/${niche}` }]
      : []
  })
}

/** The niches' own mixed feeds, interleaved: what a quiet day falls back on. */
async function sceneHighlights(niches: readonly string[]): Promise<FeedItem[]> {
  const feeds = await Promise.all(
    niches.map(async (slug) => {
      const profile = findSeedProfile(slug)
      if (!profile) return []
      const feed = await buildNicheFeed(profile, appFeedDeps()).catch(() => null)
      return (feed?.items ?? []).filter((item) => item.imageUrl)
    }),
  )
  const out: FeedItem[] = []
  const longest = Math.max(0, ...feeds.map((f) => f.length))
  for (let i = 0; i < longest; i++) for (const feed of feeds) if (feed[i]) out.push(feed[i])
  // Visual first: music has its own sections (drops, late night); video stays a garnish.
  // Artist portraits aren't scene activity (rising chips already name who's moving).
  let videos = 0
  return out.filter((item) => {
    if (item.type === "track" || item.type === "playlist" || item.type === "artist") return false
    if (item.type === "video") return ++videos <= MORE_VIDEOS
    return true
  })
}

/**
 * The Fit: posted fits since the last visit first, then images vision-tagged
 * as fits on the niches' moodboards, then fit-check videos. Never artist
 * press photos.
 */
async function newFits(niches: readonly string[], since: number): Promise<FeedItem[]> {
  const [posted, boards, feeds] = await Promise.all([
    Promise.all(niches.map((slug) => nicheFits(slug, 12))),
    Promise.all(niches.map((slug) => getMoodboard(slug))),
    Promise.all(
      niches.map(async (slug) => {
        const profile = findSeedProfile(slug)
        return profile ? buildNicheFeed(profile, appFeedDeps()).catch(() => null) : null
      }),
    ),
  ])
  const fresh = fitFeedItems(posted.flat()).filter(
    (item) => Date.parse(item.publishedAt ?? "0") > since,
  )
  // The Fit's captions name the scene each look came from.
  const inNiche = (slug: string) => (item: FeedItem) => ({
    ...item,
    meta: { ...item.meta, nicheName: findPreset(slug)?.name ?? null },
  })
  const taggedFits = boards.flatMap((board, i) =>
    moodboardFeedItems(board.pins)
      .filter((item) => item.meta.fit === true)
      .map(inNiche(niches[i] ?? "")),
  )
  const fitChecks = feeds.flatMap((feed, i) =>
    (feed?.bySource.youtube ?? [])
      .filter((item) => item.meta.fitCheck === true)
      .map(inNiche(niches[i] ?? "")),
  )
  const seen = new Set<string>()
  return [...fresh, ...taggedFits, ...fitChecks].filter(
    (item) => !seen.has(item.id) && seen.add(item.id),
  )
}

async function lateNight(niches: readonly string[]): Promise<FeedItem[]> {
  const tracks = await Promise.all(
    niches.slice(0, 3).map(async (slug) => {
      const soundtrack = await getSoundtrack(slug)
      return soundtrack ? soundtrackFeedItems(soundtrack) : []
    }),
  )
  const out: FeedItem[] = []
  const longest = Math.max(0, ...tracks.map((t) => t.length))
  for (let i = 0; i < longest; i++) for (const list of tracks) if (list[i]) out.push(list[i])
  return out
}

async function risingChips(
  niches: readonly string[],
  mine: ReadonlySet<string>,
): Promise<RisingChip[]> {
  const snapshot = await getRisingSnapshot()
  if (!snapshot) return []
  const adjacent = [
    ...new Set(niches.flatMap((slug) => TAXONOMY.adjacent(slug).map((a) => a.slug))),
  ].filter((slug) => !niches.includes(slug))
  return pickRising(snapshot.entities, { niches, mine, adjacent }, SECTION_CAPS.scene).map(
    ({ momentum: m, scope }) => ({
      entity: m.entity,
      label: m.label,
      ratio: Math.round(m.ratio * 10) / 10,
      href: hrefFor(m.entity, m.niches),
      reason: momentumReason(m),
      scope,
    }),
  )
}

const settle = async <T>(label: string, work: Promise<T[]>): Promise<T[]> => {
  try {
    return await work
  } catch (error) {
    log.warn("today.section_failed", { section: label, error: errorMessage(error) })
    return []
  }
}

/**
 * One person's edition: built from their strongest entities, for their
 * local moment. Cold start (no taste yet) uses today's featured niches and
 * global rising, and the client nudges toward the vibe check.
 */
export async function buildToday(req: TodayRequest, now = Date.now()): Promise<TodayEdition> {
  const known = (slug: string) => findSeedProfile(slug) !== undefined
  const myNiches = strongest(req, "niche").filter(known).slice(0, NICHES)
  const myArtists = strongest(req, "artist").filter((slug) => TAXONOMY.artist(slug))
  const cold = myNiches.length === 0 && myArtists.length === 0
  const niches = cold
    ? featuredOrder(new Date(now))
        .slice(0, 3)
        .map((n) => n.slug)
    : myNiches.length > 0
      ? myNiches
      : [...new Set(myArtists.flatMap((a) => TAXONOMY.nichesOfArtist(a)))].slice(0, NICHES)
  const artists = [
    ...new Set([
      ...myArtists,
      ...niches.flatMap((slug) =>
        nicheArtistsLeadFirst(slug)
          .slice(0, 2)
          .map((a) => a.slug),
      ),
    ]),
  ].slice(0, ARTISTS)
  const brands = new Set([...req.brands, ...strongest(req, "brand")].slice(0, BRANDS * 2))
  const since = req.lastVisit ?? now - FIT_DAYS * DAY

  const [dropItems, news, archive, fits, night, rising] = await Promise.all([
    settle("drops", drops(artists, now)),
    settle("news", nicheNews(niches)),
    settle("archive", listings(niches, brands, now)),
    settle("fits", newFits(niches, Math.max(since, now - FIT_DAYS * DAY))),
    settle("late-night", lateNight(niches)),
    settle(
      "rising",
      risingChips(niches, new Set(req.entities.filter((e) => e.score > 0).map((e) => e.ref))),
    ),
  ])
  const [more, friendChips] = await Promise.all([
    settle("more", sceneHighlights(niches)),
    req.viewerId ? settle("friends", friendsRow(req.viewerId, now)) : Promise.resolve([]),
  ])
  const headlines = news.filter((item) => ageMs(item, now) <= HEADLINE_HOURS * HOUR)
  const candidates: Candidates = {
    digest: headlines.filter((item) => ageMs(item, now) <= DIGEST_HOURS * HOUR),
    lateNight: night,
    drops: dropItems,
    headlines,
    archive,
    fits,
    rising,
    friends: friendChips,
    more,
  }
  const mode = todayMode(localClock(now, req.timeZone))
  const lead = findPreset(niches[0] ?? "")
  const edition = assembleEdition(candidates, { now, mode, cold, nicheName: lead?.name ?? null })
  return { ...edition, cover: { ...edition.cover, palette: lead?.palette ?? null } }
}

/** "The <niche> issue": Today's sections for one scene, read as someone who only follows it. */
export function buildNicheIssue(slug: string, now = Date.now()): Promise<TodayEdition> {
  return buildToday(
    {
      entities: [{ ref: `niche:${slug}`, score: 1 }],
      brands: [],
      lastVisit: null,
      timeZone: "UTC",
    },
    now,
  )
}
