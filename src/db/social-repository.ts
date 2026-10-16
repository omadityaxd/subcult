import { and, eq, inArray, or, sql } from "drizzle-orm"
import type { Database } from "./create-db"
import {
  type NowPlaying,
  type ProfileVisibility,
  profileSettings,
  profiles,
  userBlocks,
  userFollows,
} from "./schema"

export interface Settings {
  visibility: ProfileVisibility
  shareListening: boolean
  listening: NowPlaying | null
  listeningAt: Date | null
}

export const DEFAULT_SETTINGS: Settings = {
  visibility: "public",
  shareListening: false,
  listening: null,
  listeningAt: null,
}

export interface Relation {
  self: boolean
  following: boolean
  followedBy: boolean
  /** Either side blocked the other: nothing is shown or allowed. */
  blocked: boolean
}

export interface PersonRef {
  id: string
  handle: string
}

/** A friends-only owner's fits stay out of public lists (niche feeds, latest). */
export const friendsOnlyOwner = (userIdColumn: unknown) => sql`exists (
  select 1 from ${profileSettings}
  where ${profileSettings.userId} = ${userIdColumn} and ${profileSettings.visibility} = 'friends')`

export function createSocialRepository(db: Database) {
  const repo = {
    async byHandle(handle: string): Promise<PersonRef | null> {
      const [row] = await db
        .select({ id: profiles.id, handle: profiles.handle })
        .from(profiles)
        .where(eq(profiles.handle, handle.toLowerCase()))
        .limit(1)
      return row ?? null
    },

    async settings(userId: string): Promise<Settings> {
      const [row] = await db
        .select()
        .from(profileSettings)
        .where(eq(profileSettings.userId, userId))
      return row ?? DEFAULT_SETTINGS
    },

    async updateSettings(userId: string, patch: Partial<Settings>) {
      await db
        .insert(profileSettings)
        .values({ userId, ...patch })
        .onConflictDoUpdate({ target: profileSettings.userId, set: patch })
    },

    async relation(viewerId: string | null, targetId: string): Promise<Relation> {
      if (!viewerId) return { self: false, following: false, followedBy: false, blocked: false }
      if (viewerId === targetId)
        return { self: true, following: false, followedBy: false, blocked: false }
      const [follows, blocks] = await Promise.all([
        db
          .select()
          .from(userFollows)
          .where(
            or(
              and(eq(userFollows.followerId, viewerId), eq(userFollows.followeeId, targetId)),
              and(eq(userFollows.followerId, targetId), eq(userFollows.followeeId, viewerId)),
            ),
          ),
        db
          .select()
          .from(userBlocks)
          .where(
            or(
              and(eq(userBlocks.blockerId, viewerId), eq(userBlocks.blockedId, targetId)),
              and(eq(userBlocks.blockerId, targetId), eq(userBlocks.blockedId, viewerId)),
            ),
          ),
      ])
      return {
        self: false,
        following: follows.some((f) => f.followerId === viewerId),
        followedBy: follows.some((f) => f.followerId === targetId),
        blocked: blocks.length > 0,
      }
    },

    /** False when either side has blocked the other. True when newly followed. */
    async follow(followerId: string, followeeId: string): Promise<boolean> {
      if (followerId === followeeId) return false
      if ((await repo.relation(followerId, followeeId)).blocked) return false
      const rows = await db
        .insert(userFollows)
        .values({ followerId, followeeId })
        .onConflictDoNothing()
        .returning({ id: userFollows.followerId })
      return rows.length > 0
    },

    async unfollow(followerId: string, followeeId: string) {
      await db
        .delete(userFollows)
        .where(and(eq(userFollows.followerId, followerId), eq(userFollows.followeeId, followeeId)))
    },

    /** Block: no follows either way, and no new ones. */
    async block(blockerId: string, blockedId: string) {
      if (blockerId === blockedId) return
      await db.insert(userBlocks).values({ blockerId, blockedId }).onConflictDoNothing()
      await repo.unfollow(blockerId, blockedId)
      await repo.unfollow(blockedId, blockerId)
    },

    async unblock(blockerId: string, blockedId: string) {
      await db
        .delete(userBlocks)
        .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)))
    },

    async following(userId: string): Promise<PersonRef[]> {
      return db
        .select({ id: profiles.id, handle: profiles.handle })
        .from(userFollows)
        .innerJoin(profiles, eq(profiles.id, userFollows.followeeId))
        .where(eq(userFollows.followerId, userId))
    },

    async followers(userId: string): Promise<PersonRef[]> {
      return db
        .select({ id: profiles.id, handle: profiles.handle })
        .from(userFollows)
        .innerJoin(profiles, eq(profiles.id, userFollows.followerId))
        .where(eq(userFollows.followeeId, userId))
    },

    async blocked(userId: string): Promise<PersonRef[]> {
      return db
        .select({ id: profiles.id, handle: profiles.handle })
        .from(userBlocks)
        .innerJoin(profiles, eq(profiles.id, userBlocks.blockedId))
        .where(eq(userBlocks.blockerId, userId))
    },

    async counts(userId: string): Promise<{ followers: number; following: number }> {
      const [row] = await db.execute<{ followers: number; following: number }>(sql`
        select
          (select count(*)::int from ${userFollows} where ${userFollows.followeeId} = ${userId}) as followers,
          (select count(*)::int from ${userFollows} where ${userFollows.followerId} = ${userId}) as following`)
      return { followers: row?.followers ?? 0, following: row?.following ?? 0 }
    },

    /** Visibility settings for many people at once (friends row, follower lists). */
    async visibilities(userIds: readonly string[]): Promise<Map<string, ProfileVisibility>> {
      if (userIds.length === 0) return new Map()
      const rows = await db
        .select({ userId: profileSettings.userId, visibility: profileSettings.visibility })
        .from(profileSettings)
        .where(inArray(profileSettings.userId, [...userIds]))
      return new Map(rows.map((r) => [r.userId, r.visibility]))
    },
  }
  return repo
}

export type SocialRepository = ReturnType<typeof createSocialRepository>

/**
 * Who sees a profile's fits, niches and listening: everyone when public;
 * when friends-only, the owner and mutual follows. Blocks hide everything.
 */
export function canView(visibility: ProfileVisibility, relation: Relation): boolean {
  if (relation.blocked) return false
  if (relation.self || visibility === "public") return true
  return relation.following && relation.followedBy
}
