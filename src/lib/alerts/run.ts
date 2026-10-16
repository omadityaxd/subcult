import "server-only"
import type { AlertsRepository, Prefs } from "@/db/alerts-repository"
import { createTasteRepository } from "@/db/taste-repository"
import type { Database } from "@/db/create-db"
import { errorMessage, log } from "@/lib/log"
import { artistReleases } from "@/lib/music/releases-server"
import { TAXONOMY, findPreset } from "@/lib/niches/catalog"
import { getRisingSnapshot } from "@/lib/rising/server"
import { searchListings } from "@/lib/shop/ebay"
import { ebayCredentials } from "@/lib/shop/server"
import { entitySlug } from "@/lib/taste/entities"
import { computeAffinity, topEntities } from "@/lib/taste/model"
import {
  NICHE_ALERT_RATIO,
  batchPush,
  inQuietHours,
  matchesGrail,
  nicheAlertAllowed,
  pushAllowed,
} from "./policy"
import { sendPush } from "./push"

const DAY_MS = 24 * 3600_000
/** Only listings and releases this new are news. */
const FRESH_LISTING_MS = 3 * DAY_MS
const FRESH_RELEASE_MS = 2 * DAY_MS
/** eBay Browse allows 5,000 calls a day; hunts use a small, predictable slice. */
const MAX_GRAIL_CHECKS = 400
const DROP_ARTISTS = 8

export interface AlertRunReport {
  grailsChecked: number
  notified: { grail: number; drop: number; niche: number }
  pushed: number
  skipped: { quiet: number; capped: number; noDevice: number }
}

async function runGrails(
  repo: AlertsRepository,
  prefsOf: (userId: string) => Promise<Prefs>,
  now: number,
  report: AlertRunReport,
) {
  const credentials = ebayCredentials()
  if (!credentials) return
  const hunts = (await repo.allGrails()).slice(0, MAX_GRAIL_CHECKS)
  for (const hunt of hunts) {
    if (!(await prefsOf(hunt.userId)).grails) continue
    try {
      const listings = await searchListings(`${hunt.brand} ${hunt.item}`, credentials, {
        maxPrice: hunt.maxPrice,
        newest: true,
        limit: 50,
      })
      report.grailsChecked += 1
      for (const listing of listings) {
        const fresh =
          listing.createdAt !== null && now - Date.parse(listing.createdAt) <= FRESH_LISTING_MS
        if (!fresh || !matchesGrail(listing, hunt)) continue
        const added = await repo.notify(hunt.userId, {
          type: "grail",
          title: `${hunt.brand} ${hunt.item} for $${Math.round(listing.price)}`,
          body: listing.title,
          url: listing.url,
          imageUrl: listing.imageUrl,
          dedupeKey: `grail:${hunt.id}:${listing.id}`,
        })
        if (added) report.notified.grail += 1
      }
      await repo.grailChecked(hunt.id)
    } catch (error) {
      log.warn("alerts.grail_failed", { hunt: hunt.id, error: errorMessage(error) })
    }
  }
}

/** Drops from the artists each person actually plays/saves, and their niches' momentum. */
async function runTaste(
  db: Database,
  repo: AlertsRepository,
  userId: string,
  prefs: Prefs,
  now: number,
  report: AlertRunReport,
) {
  const signals = await createTasteRepository(db).recent(userId, now)
  if (signals.length === 0) return
  const vector = computeAffinity(signals, now)

  if (prefs.drops) {
    for (const artist of topEntities(vector, DROP_ARTISTS, "artist")) {
      const slug = entitySlug(artist.entity)
      const known = TAXONOMY.artist(slug)
      if (!known) continue
      for (const release of await artistReleases(slug, known.name)) {
        if (now - Date.parse(release.releasedAt) > FRESH_RELEASE_MS) continue
        const added = await repo.notify(userId, {
          type: "drop",
          title: `${known.name} dropped ${release.title}`,
          body: release.kind === "single" ? "New single" : `New ${release.kind}`,
          url: release.appleUrl ?? `/n/${TAXONOMY.nichesOfArtist(slug)[0] ?? ""}`,
          imageUrl: release.artworkUrl,
          dedupeKey: `drop:${release.id}`,
        })
        if (added) report.notified.drop += 1
      }
    }
  }

  if (prefs.niches && nicheAlertAllowed(prefs.lastNicheAlertAt?.getTime() ?? null, now)) {
    const snapshot = await getRisingSnapshot()
    const followed = [...vector.values()].filter(
      (a) => a.entity.startsWith("niche:") && a.because === "follow" && a.score > 0,
    )
    const hot = followed
      .map((a) => ({ a, m: snapshot?.niches[entitySlug(a.entity)] ?? null }))
      .filter(({ m }) => m !== null && m.ratio >= NICHE_ALERT_RATIO)
      .sort((x, y) => (y.m?.ratio ?? 0) - (x.m?.ratio ?? 0))[0]
    if (hot?.m) {
      const slug = entitySlug(hot.a.entity)
      const week = Math.floor(now / (7 * DAY_MS))
      const added = await repo.notify(userId, {
        type: "niche",
        title: `${findPreset(slug)?.name ?? hot.a.label} is blowing up`,
        body: `${hot.m.ratio.toFixed(1)}× its usual activity this week`,
        url: `/n/${slug}`,
        dedupeKey: `niche:${slug}:${week}`,
      })
      if (added) {
        report.notified.niche += 1
        await repo.updatePrefs(userId, { lastNicheAlertAt: new Date(now) })
      }
    }
  }
}

/**
 * Sends at most one push per person per day, outside their quiet hours,
 * batching whatever is unread and unpushed. Without push, the in-app
 * center (and the dot on the bell) carries everything.
 */
export async function deliver(
  repo: AlertsRepository,
  userId: string,
  prefs: Prefs,
  now: number,
  report: AlertRunReport,
): Promise<void> {
  const pending = await repo.pendingPush(userId, now)
  if (pending.length === 0) return
  if (inQuietHours(now, prefs.timeZone, prefs.quietStart, prefs.quietEnd)) {
    report.skipped.quiet += 1
    return
  }
  if (!pushAllowed(prefs.lastPushAt?.getTime() ?? null, now)) {
    report.skipped.capped += 1
    return
  }
  const payload = batchPush(pending)
  if (!payload) return
  const delivered = await sendPush(repo, userId, payload)
  if (delivered === 0) {
    report.skipped.noDevice += 1
    return
  }
  await repo.markPushed(
    userId,
    pending.map((n) => n.id),
    new Date(now),
  )
  report.pushed += 1
}

/** The daily alerts run: grail hunts, drops, niche momentum, then one batched push each. */
export async function runAlerts(
  db: Database,
  repo: AlertsRepository,
  now = Date.now(),
): Promise<AlertRunReport> {
  const report: AlertRunReport = {
    grailsChecked: 0,
    notified: { grail: 0, drop: 0, niche: 0 },
    pushed: 0,
    skipped: { quiet: 0, capped: 0, noDevice: 0 },
  }
  const prefsCache = new Map<string, Promise<Prefs>>()
  const prefsOf = (userId: string) => {
    if (!prefsCache.has(userId)) prefsCache.set(userId, repo.prefs(userId))
    return prefsCache.get(userId) as Promise<Prefs>
  }
  await runGrails(repo, prefsOf, now, report)
  for (const userId of await repo.alertUsers()) {
    try {
      const prefs = await prefsOf(userId)
      await runTaste(db, repo, userId, prefs, now, report)
      // Re-read: the niche alert may have just moved lastNicheAlertAt.
      await deliver(repo, userId, await repo.prefs(userId), now, report)
    } catch (error) {
      log.warn("alerts.user_failed", { error: errorMessage(error) })
    }
  }
  return report
}
