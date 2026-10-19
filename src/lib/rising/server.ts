import "server-only"
import { and, gte, inArray, sql } from "drizzle-orm"
import { getDb } from "@/db"
import { tasteSignals } from "@/db/schema"
import { mapWithConcurrency } from "@/lib/concurrency"
import type { NicheProfile } from "@/lib/engine/profile-schema"
import { appFeedDeps } from "@/lib/feed/app-deps"
import { judgeItem } from "@/lib/feed/clean"
import { isExcludedContent } from "@/lib/feed/excluded"
import { buildNicheFeed } from "@/lib/feed/feed"
import { newsEntities, newsQueriesFor, onTopic } from "@/lib/feed/fetchers/news"
import { nicheCleanContext } from "@/lib/feed/niche-relevance"
import { containsTerm, isAmbiguous } from "@/lib/feed/relevance"
import { errorMessage, log } from "@/lib/log"
import { artistReleases } from "@/lib/music/releases-server"
import { getCacheStore } from "@/lib/music/server"
import { SEED_PROFILES, TAXONOMY, nicheArtistsLeadFirst } from "@/lib/niches/catalog"
import { fetchGoogleNews } from "@/lib/sources/google-news"
import { type EntityRef, entityRef } from "@/lib/taste/entities"
import {
  BASELINE_DAYS,
  type EntityEvent,
  type Momentum,
  RECENT_DAYS,
  mentions,
  rising,
} from "./momentum"

const WINDOW_DAYS = RECENT_DAYS + BASELINE_DAYS
const DAY_MS = 24 * 3600_000
const NICHE_WORKERS = 4
const RELEASE_BUDGET_MS = 90_000

async function mapSequential<T, R>(items: readonly T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (const item of items) out.push(await fn(item))
  return out
}
/** Artists per niche whose releases count (lead first). */
const RELEASE_ARTISTS = 2
// Snapshots from before weekly counts (Momentum.week) still read: they just have no reason line.
const SNAPSHOT_KEY = "subcult:rising:v1"
const SNAPSHOT_TTL = 36 * 3600

export interface RisingSnapshot {
  computedAt: number
  /** Everything with real momentum, strongest first. */
  entities: Momentum[]
  /** Per niche: its own momentum (null when it has too little data). */
  niches: Record<string, Momentum | null>
  /** How many events each source contributed (sanity check for the admin/CLI). */
  sources: Record<string, number>
}

interface Matcher {
  ref: EntityRef
  label: string
  match: (title: string) => boolean
}

function matchersFor(profile: NicheProfile): Matcher[] {
  const { artists, brands } = newsEntities(profile)
  const artistSlugs = new Map(TAXONOMY.artistsOf(profile.slug).map((a) => [a.name, a.slug]))
  const brandSlugs = new Map(TAXONOMY.brandsOf(profile.slug).map((b) => [b.name, b.slug]))
  const make = (type: "artist" | "brand", name: string, slug: string | undefined): Matcher[] => {
    const ref = slug ? entityRef(type, slug) : null
    if (!ref || isAmbiguous(name)) return []
    return [
      {
        ref,
        label: name,
        match: (title) => containsTerm(title, name) && onTopic(title, profile),
      },
    ]
  }
  return [
    ...artists.flatMap((name) => make("artist", name, artistSlugs.get(name))),
    ...brands.flatMap((name) => make("brand", name, brandSlugs.get(name))),
  ]
}

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** A search returning this many items was cut off by Google's ~100-item cap. */
const SATURATED = 90
const WEEKS = (RECENT_DAYS + BASELINE_DAYS) / 7

/**
 * Five one-week windows, searched separately: each search returns at most
 * ~100 items, so wider windows would undercount busy weeks and fake a rise.
 */
function weeklyWindows(now: number) {
  return Array.from({ length: WEEKS }, (_, week) => ({
    range: {
      after: isoDay(now - (week + 1) * 7 * DAY_MS),
      before: isoDay(now - week * 7 * DAY_MS + DAY_MS),
    },
  }))
}

/**
 * A query's headlines over five weeks, or [] when any week hit the cap:
 * a saturated count can't show momentum honestly, so it doesn't vote.
 */
async function weeklyHeadlines(query: string, now: number) {
  const weeks = await Promise.all(
    weeklyWindows(now).map((window) => fetchGoogleNews(query, window).catch(() => null)),
  )
  if (weeks.some((week) => week === null || week.length >= SATURATED)) {
    log.info("rising.query_skipped", {
      query,
      reason: weeks.some((w) => w === null) ? "failed" : "saturated",
    })
    return []
  }
  return weeks.flatMap((week) => week ?? [])
}

/** Headlines over 5 weeks and recent uploads, as dated entity + niche events. */
async function nicheEvents(profile: NicheProfile, now: number): Promise<EntityEvent[]> {
  const matchers = matchersFor(profile)
  const ctx = nicheCleanContext(profile)
  const nicheRef = entityRef("niche", profile.slug)
  const perQuery = []
  for (const query of newsQueriesFor(profile)) perQuery.push(await weeklyHeadlines(query, now))
  const seen = new Set<string>()
  const headlines = perQuery
    .flat()
    .filter(
      (a) =>
        !seen.has(a.title) &&
        seen.add(a.title) &&
        onTopic(a.title, profile) &&
        !isExcludedContent(a.title),
    )
    .map((a) => ({ title: a.title, at: a.publishedAt?.getTime() ?? null, domain: a.domain }))

  const feed = await buildNicheFeed(profile, appFeedDeps()).catch(() => null)
  const uploads = (feed?.bySource.youtube ?? []).map((item) => ({
    title: item.title,
    at: item.publishedAt ? Date.parse(item.publishedAt) : null,
  }))

  const nicheLevel = (
    items: { title: string; at: number | null; domain?: string | null }[],
    source: "headline" | "upload",
  ) =>
    nicheRef
      ? items.flatMap((item) => {
          if (item.at === null) return []
          const judged = judgeItem(
            {
              id: item.title,
              source: source === "headline" ? "news" : "youtube",
              type: source === "headline" ? "article" : "video",
              title: item.title,
              subtitle: null,
              imageUrl: null,
              url: "https://example.com",
              publishedAt: null,
              score: 0,
              meta: { domain: item.domain ?? null },
            },
            ctx,
          )
          return judged === null
            ? [{ entity: nicheRef, label: profile.name, niche: profile.slug, source, at: item.at }]
            : []
        })
      : []

  return [
    ...mentions(headlines, matchers, profile.slug, "headline"),
    ...mentions(uploads, matchers, profile.slug, "upload"),
    ...nicheLevel(headlines, "headline"),
    ...nicheLevel(uploads, "upload"),
  ]
}

async function releaseEvents(profile: NicheProfile): Promise<EntityEvent[]> {
  const artists = nicheArtistsLeadFirst(profile.slug).slice(0, RELEASE_ARTISTS)
  // Sequential: iTunes answers 403 beyond ~20 calls a minute.
  const lists = await mapSequential(artists, async (artist) => ({
    artist,
    releases: await artistReleases(artist.slug, artist.name),
  }))
  const nicheRef = entityRef("niche", profile.slug)
  return lists.flatMap(({ artist, releases }) =>
    releases.flatMap((release) => {
      const at = Date.parse(release.releasedAt)
      const ref = entityRef("artist", artist.slug)
      return [
        ...(ref
          ? [
              {
                entity: ref,
                label: artist.name,
                niche: profile.slug,
                source: "release" as const,
                at,
              },
            ]
          : []),
        ...(nicheRef
          ? [
              {
                entity: nicheRef,
                label: profile.name,
                niche: profile.slug,
                source: "release" as const,
                at,
              },
            ]
          : []),
      ]
    }),
  )
}

/** Saves and plays inside subcult (signed-in users' synced signals), per entity per day. */
async function inAppEvents(now: number): Promise<EntityEvent[]> {
  const db = getDb()
  if (!db) return []
  // Literal divisor: a bound parameter would differ between SELECT and GROUP BY.
  const day = sql<number>`(${tasteSignals.at} / ${sql.raw(String(DAY_MS))})::bigint`
  const rows = await db
    .select({
      entity: tasteSignals.entity,
      label: sql<string>`max(${tasteSignals.label})`,
      kind: tasteSignals.kind,
      day,
      count: sql<number>`count(distinct ${tasteSignals.userId})::int`,
    })
    .from(tasteSignals)
    .where(
      and(
        gte(tasteSignals.at, now - WINDOW_DAYS * DAY_MS),
        inArray(tasteSignals.kind, ["save", "play", "play_through", "follow"]),
      ),
    )
    .groupBy(tasteSignals.entity, tasteSignals.kind, day)
  return rows.flatMap((row) => {
    const ref = entityRef(
      row.entity.slice(0, row.entity.indexOf(":")) as "artist",
      row.entity.slice(row.entity.indexOf(":") + 1),
    )
    if (!ref) return []
    const source = row.kind === "save" || row.kind === "follow" ? "save" : "play"
    const niche = ref.startsWith("niche:")
      ? ref.slice("niche:".length)
      : (TAXONOMY.nichesOfArtist(ref.slice(ref.indexOf(":") + 1))[0] ?? "")
    // One event per distinct user per day: a single person can't make something "rise".
    return Array.from({ length: row.count }, () => ({
      entity: ref,
      label: row.label,
      niche,
      source,
      at: Number(row.day) * DAY_MS + DAY_MS / 2,
    })) satisfies EntityEvent[]
  })
}

/** Daily: gathers 5 weeks of dated events for every curated niche and stores what's rising. */
export async function computeRisingSnapshot(now = Date.now()): Promise<RisingSnapshot> {
  const perNiche = await mapWithConcurrency(SEED_PROFILES, NICHE_WORKERS, (profile) =>
    nicheEvents(profile, now),
  )
  // Releases in their own throttled pass, under a time budget; cached lookups are instant,
  // so coverage grows day by day without tripping iTunes' rate limit.
  const releaseDeadline = Date.now() + RELEASE_BUDGET_MS
  const releases: EntityEvent[] = []
  for (const profile of SEED_PROFILES) {
    if (Date.now() > releaseDeadline) break
    releases.push(...(await releaseEvents(profile).catch(() => [])))
  }
  const events: EntityEvent[] = perNiche.flatMap((r, i) => {
    if (r.status === "fulfilled") return r.value
    log.warn("rising.niche_failed", { slug: SEED_PROFILES[i]?.slug, error: errorMessage(r.reason) })
    return []
  })
  const inApp = await inAppEvents(now).catch((error: unknown) => {
    log.warn("rising.in_app_failed", { error: errorMessage(error) })
    return []
  })
  const all = [...events, ...releases, ...inApp]
  const top = rising(all, now, 200)
  const niches = Object.fromEntries(
    SEED_PROFILES.map((p) => [p.slug, top.find((m) => m.entity === `niche:${p.slug}`) ?? null]),
  )
  const sources: Record<string, number> = {}
  for (const event of all) sources[event.source] = (sources[event.source] ?? 0) + 1
  return { computedAt: now, entities: top, niches, sources }
}

export async function saveRisingSnapshot(snapshot: RisingSnapshot): Promise<void> {
  await getCacheStore().set(SNAPSHOT_KEY, snapshot, SNAPSHOT_TTL)
}

/** The latest snapshot, or null before the first cron run. */
export async function getRisingSnapshot(): Promise<RisingSnapshot | null> {
  try {
    const value = await getCacheStore().get(SNAPSHOT_KEY)
    return value && typeof value === "object" && "entities" in value
      ? (value as RisingSnapshot)
      : null
  } catch {
    return null
  }
}
