import { and, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm"
import type { AlertType } from "../lib/alerts/policy"
import type { Database } from "./create-db"
import {
  type AlertPrefsRow,
  type GrailSearchRow,
  type NotificationRow,
  alertPrefs,
  grailSearches,
  notifications,
  pushSubscriptions,
} from "./schema"

export const MAX_GRAIL_SEARCHES = 20
const PUSH_WINDOW_MS = 2 * 24 * 3600_000

export interface NewNotification {
  type: AlertType
  title: string
  body?: string | null
  url: string
  imageUrl?: string | null
  dedupeKey: string
}

export type Prefs = Pick<
  AlertPrefsRow,
  "drops" | "grails" | "niches" | "friends" | "quietStart" | "quietEnd" | "timeZone"
> &
  Pick<AlertPrefsRow, "lastPushAt" | "lastNicheAlertAt">

export const DEFAULT_PREFS: Prefs = {
  drops: true,
  grails: true,
  niches: true,
  friends: true,
  quietStart: 23 * 60,
  quietEnd: 9 * 60,
  timeZone: "UTC",
  lastPushAt: null,
  lastNicheAlertAt: null,
}

export function createAlertsRepository(db: Database) {
  return {
    async savePushSubscription(
      userId: string,
      sub: { endpoint: string; p256dh: string; auth: string },
    ) {
      await db
        .insert(pushSubscriptions)
        .values({ userId, ...sub })
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: { userId, p256dh: sub.p256dh, auth: sub.auth },
        })
    },

    async deletePushSubscription(endpoint: string, userId?: string) {
      await db
        .delete(pushSubscriptions)
        .where(
          userId
            ? and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId))
            : eq(pushSubscriptions.endpoint, endpoint),
        )
    },

    subscriptionsOf(userId: string) {
      return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId))
    },

    async prefs(userId: string): Promise<Prefs> {
      const [row] = await db.select().from(alertPrefs).where(eq(alertPrefs.userId, userId))
      return row ?? DEFAULT_PREFS
    },

    async updatePrefs(userId: string, patch: Partial<Prefs>) {
      await db
        .insert(alertPrefs)
        .values({ userId, ...patch })
        .onConflictDoUpdate({ target: alertPrefs.userId, set: { ...patch, updatedAt: new Date() } })
    },

    /** Inserts unless the same event already notified this person. True when new. */
    async notify(userId: string, n: NewNotification): Promise<boolean> {
      const inserted = await db
        .insert(notifications)
        .values({ userId, ...n })
        .onConflictDoNothing()
        .returning({ id: notifications.id })
      return inserted.length > 0
    },

    list(userId: string, limit = 50): Promise<NotificationRow[]> {
      return db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
    },

    async unreadCount(userId: string): Promise<number> {
      const [row] = await db
        .select({ n: count() })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
      return row?.n ?? 0
    },

    async markAllRead(userId: string) {
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    },

    /** Unread, never pushed, from the last two days: what the next push would batch. */
    pendingPush(userId: string, now = Date.now()) {
      return db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            isNull(notifications.readAt),
            isNull(notifications.pushedAt),
            gte(notifications.createdAt, new Date(now - PUSH_WINDOW_MS)),
          ),
        )
        .orderBy(desc(notifications.createdAt))
    },

    async markPushed(userId: string, ids: readonly number[], now = new Date()) {
      if (ids.length > 0) {
        await db
          .update(notifications)
          .set({ pushedAt: now })
          .where(and(eq(notifications.userId, userId), inArray(notifications.id, [...ids])))
      }
      await this.updatePrefs(userId, { lastPushAt: now })
    },

    grailsOf(userId: string): Promise<GrailSearchRow[]> {
      return db
        .select()
        .from(grailSearches)
        .where(eq(grailSearches.userId, userId))
        .orderBy(desc(grailSearches.createdAt))
    },

    allGrails(): Promise<GrailSearchRow[]> {
      return db.select().from(grailSearches).orderBy(grailSearches.lastCheckedAt)
    },

    /** Null when the person already has the maximum number of hunts. */
    async addGrail(
      userId: string,
      grail: Pick<GrailSearchRow, "brandSlug" | "brand" | "item" | "maxPrice" | "size">,
    ): Promise<GrailSearchRow | null> {
      const [existing] = await db
        .select({ n: count() })
        .from(grailSearches)
        .where(eq(grailSearches.userId, userId))
      if ((existing?.n ?? 0) >= MAX_GRAIL_SEARCHES) return null
      const [row] = await db
        .insert(grailSearches)
        .values({ userId, ...grail })
        .returning()
      return row ?? null
    },

    async deleteGrail(userId: string, id: string) {
      await db
        .delete(grailSearches)
        .where(and(eq(grailSearches.userId, userId), eq(grailSearches.id, id)))
    },

    async grailChecked(id: string, at = new Date()) {
      await db.update(grailSearches).set({ lastCheckedAt: at }).where(eq(grailSearches.id, id))
    },

    /** Everyone with something to be alerted about: prefs, hunts or a push subscription. */
    async alertUsers(): Promise<string[]> {
      const rows = await db.execute<{ user_id: string }>(sql`
        select user_id from ${alertPrefs}
        union select user_id from ${grailSearches}
        union select user_id from ${pushSubscriptions}`)
      return [...rows].map((r) => r.user_id)
    },
  }
}

export type AlertsRepository = ReturnType<typeof createAlertsRepository>
