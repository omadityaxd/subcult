import "server-only"
import { cache } from "react"
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
import { containsTerm, isAmbiguous } from "@/lib/feed/relevance"
import { type CoverArt, chooseCoverArt } from "./cover-art"
import { curateCandidates } from "./curate"
import { isHeavy } from "./heavy"
import { entityPhoto, withTeaImage } from "./tea-image"
import { moodboardFeedItems } from "@/lib/moodboard/board"
import { getMoodboard } from "@/lib/moodboard/server"
import { momentumReason } from "@/lib/rising/momentum"
import { pickRising } from "@/lib/rising/pick"
import { getRisingSnapshot } from "@/lib/rising/server"
import { type FactsMap, fitsSlot } from "@/lib/images/curate"
import { canonicalImage } from "@/lib/images/variants"
import { imageFactsFor, youtubeMaxres } from "@/lib/images/facts-server"
import { friendsInto } from "@/lib/social/server"
import { archiveFeedItems, getArchive } from "@/lib/shop/server"
import {
  type EntityRef,
  encodeEntities,
  entityRef,
  entitySlug,
  entityType,
} from "@/lib/taste/entities"
import {
  type Candidates,
  type FriendChip,
  type RisingChip,
  SECTION_CAPS,
  type TodayEdition,
  assembleEdition,
  localClock,
  newestFirst,
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
  /** A niche page's issue: The Scene keeps to this niche's verified entities (plus "nearby"). */
  scopeNiche?: string
}

/** The niche itself and its verified artists and brands: what a niche page's Scene may list. */
function verifiedEntities(slug: string): Set<string> {
  return new Set(
    [
      entityRef("niche", slug),
      ...TAXONOMY.artistsOf(slug).map((artist) => entityRef("artist", artist.slug)),
      ...TAXONOMY.brandsOf(slug).map((brand) => entityRef("brand", brand.slug)),
    ].filter((ref): ref is EntityRef => ref !== null),
  )
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
    // Heavy news (violence, legal trouble) stays in The Tea but never leads (see heavy.ts).
    const names = TAXONOMY.artistsOf(slug)
      .map((artist) => artist.name)
      .filter((name) => !isAmbiguous(name))
    const heavy = isHeavy(item.title, (title) => names.some((name) => containsTerm(title, name)))
    const flagged = heavy ? { ...item, meta: { ...item.meta, heavy: true } } : item
    return withTeaImage(flagged, {
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

/** The Sound's picks: the reader's top scenes' soundtracks, interleaved strongest scene first. */
async function soundPicks(niches: readonly string[]): Promise<FeedItem[]> {
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
  scopeNiche?: string,
): Promise<RisingChip[]> {
  const snapshot = await getRisingSnapshot()
  if (!snapshot) return []
  const adjacent = [
    ...new Set(niches.flatMap((slug) => TAXONOMY.adjacent(slug).map((a) => a.slug))),
  ].filter((slug) => !niches.includes(slug))
  const verified = scopeNiche ? verifiedEntities(scopeNiche) : undefined
  return pickRising(
    snapshot.entities,
    { niches, mine, adjacent, verified },
    SECTION_CAPS.scene,
  ).map(({ momentum: m, scope }) => ({
    entity: m.entity,
    label: m.label,
    ratio: Math.round(m.ratio * 10) / 10,
    href: hrefFor(m.entity, m.niches),
    reason: momentumReason(m),
    scope,
  }))
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

  const [dropItems, news, archive, fits, picks, rising] = await Promise.all([
    settle("drops", drops(artists, now)),
    settle("news", nicheNews(niches)),
    settle("archive", listings(niches, brands, now)),
    settle("fits", newFits(niches, Math.max(since, now - FIT_DAYS * DAY))),
    settle("sound-picks", soundPicks(niches)),
    settle(
      "rising",
      risingChips(
        niches,
        new Set(req.entities.filter((e) => e.score > 0).map((e) => e.ref)),
        req.scopeNiche,
      ),
    ),
  ])
  const [more, friendChips] = await Promise.all([
    settle("more", sceneHighlights(niches)),
    req.viewerId ? settle("friends", friendsRow(req.viewerId, now)) : Promise.resolve([]),
  ])
  const headlines = news.filter((item) => ageMs(item, now) <= HEADLINE_HOURS * HOUR)
  const candidates: Candidates = {
    digest: headlines.filter((item) => ageMs(item, now) <= DIGEST_HOURS * HOUR),
    soundPicks: picks,
    drops: dropItems,
    headlines,
    archive,
    fits,
    rising,
    friends: friendChips,
    more,
  }
  const { curated, facts } = await withImageQuality(candidates)
  const mode = todayMode(localClock(now, req.timeZone))
  const lead = findPreset(niches[0] ?? "")
  const edition = assembleEdition(curated, {
    now,
    mode,
    cold,
    nicheName: lead?.name ?? null,
    // A cover is printed big: measured ≥1200px wide, and never a vertical Short.
    coverOk: (item) => item.meta.short !== true && fitsSlot(item.imageUrl, "cover", facts),
  })
  const art = edition.cover.item ? null : await coverArt(niches, curated, now, edition)
  return { ...edition, cover: { ...edition.cover, palette: lead?.palette ?? null, art } }
}

/** Portraits measured for a cover: the lead scenes' first few verified artists. */
const COVER_PORTRAITS = 6
const COVER_ART_BUDGET_MS = 1500

/** No fit or grail cover: the best artist portrait, else a mosaic, else the palette. */
async function coverArt(
  niches: readonly string[],
  curated: Candidates,
  now: number,
  edition: TodayEdition,
): Promise<CoverArt | null> {
  // Never a picture the issue already prints (a Tea story can borrow an artist's photo).
  const used = new Set(
    [...edition.sections.flatMap((s) => s.items), edition.copOrDrop].flatMap((item) =>
      item?.imageUrl ? [canonicalImage(item.imageUrl)] : [],
    ),
  )
  const unused = (url: string) => !used.has(canonicalImage(url))
  const seen = new Set<string>()
  const portraits = niches
    .flatMap((slug) => nicheArtistsLeadFirst(slug).slice(0, 3))
    .flatMap((artist) =>
      artist.imageUrl && unused(artist.imageUrl) && !seen.has(artist.slug) && seen.add(artist.slug)
        ? [{ imageUrl: artist.imageUrl, label: artist.name }]
        : [],
    )
    .slice(0, COVER_PORTRAITS)
  const facts = await imageFactsFor(
    portraits.map((p) => p.imageUrl),
    COVER_ART_BUDGET_MS,
  ).catch((): FactsMap => new Map())
  // Square album art makes the best mosaic tiles.
  const pictures = [...curated.drops, ...curated.soundPicks].flatMap((item) =>
    item.imageUrl && unused(item.imageUrl) ? [item.imageUrl] : [],
  )
  return chooseCoverArt(portraits, pictures, facts, Math.floor(now / DAY))
}

/**
 * Fit videos tried at YouTube's 1280px thumbnail, the only sharp one: the
 * ones the issue will show (newest first), cover and Cop or Drop included. Shorts too: their
 * video column is 405px there against 202px in the default thumbnail.
 */
// The Fit, the cover, and the Cop or Drop pick (usually the next fit after the section).
const MAXRES_TRIES = SECTION_CAPS.fit + 2
/** Images measured per issue (cached for a month, so mostly instant). */
const MEASURED = 80

/**
 * Image quality for an issue: fit videos upgraded to YouTube's 1280px
 * thumbnail where one exists, every picture measured (within a time
 * budget), repeats removed across sections and subjects located.
 */
async function withImageQuality(c: Candidates): Promise<{ curated: Candidates; facts: FactsMap }> {
  const videos = [...c.fits]
    .sort(newestFirst)
    .filter((item) => item.source === "youtube" && item.imageUrl)
    .slice(0, MAXRES_TRIES)
  const upgrades = new Map(
    await Promise.all(
      videos.map(async (item) => [item.id, await youtubeMaxres(item.imageUrl ?? "")] as const),
    ),
  )
  const fits = c.fits.map((item) => {
    const better = upgrades.get(item.id)
    return better ? { ...item, imageUrl: better } : item
  })
  const pictured = [fits, c.archive, c.headlines, c.drops, c.soundPicks, c.more]
    .flat()
    .map((item) => item.imageUrl)
    .slice(0, MEASURED)
  const facts = await imageFactsFor(pictured)
  return { curated: curateCandidates({ ...c, fits }, facts), facts }
}

/**
 * "The <niche> issue": Today's sections for one scene, read as someone who
 * only follows it. Memoized per request: the niche page's feed reads it too,
 * to leave out what the issue already shows.
 */
export const buildNicheIssue = cache((slug: string): Promise<TodayEdition> =>
  buildToday({
    entities: [{ ref: `niche:${slug}`, score: 1 }],
    brands: [],
    lastVisit: null,
    timeZone: "UTC",
    scopeNiche: slug,
  }),
)
