import { and, arrayContains, desc, eq, gt, inArray, lt, not, sql } from "drizzle-orm"
import type { Database } from "./create-db"
import { friendsOnlyOwner } from "./social-repository"
import {
  type FitPiece,
  type FitRow,
  type FitSong,
  type FitStatus,
  fitLikes,
  fitReports,
  fitSaves,
  fits,
  profiles,
} from "./schema"

export interface FitWithAuthor extends FitRow {
  handle: string
}

export async function getProfile(db: Database, userId: string) {
  const [row] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1)
  return row ?? null
}

/** Claims a handle for a user. Returns false when someone else already has it. */
export async function claimHandle(db: Database, userId: string, handle: string): Promise<boolean> {
  const rows = await db
    .insert(profiles)
    .values({ id: userId, handle })
    .onConflictDoNothing()
    .returning({ id: profiles.id })
  if (rows.length > 0) return true
  const existing = await getProfile(db, userId)
  return existing?.handle === handle
}

export async function insertFit(
  db: Database,
  fit: {
    id: string
    userId: string
    imagePath: string
    width: number
    height: number
    caption: string | null
    niches: string[]
    brands: string[]
    pieces: FitPiece[]
    song: FitSong | null
  },
): Promise<FitRow> {
  const [row] = await db.insert(fits).values(fit).returning()
  return row
}

const withAuthor = { fit: fits, handle: profiles.handle }

/** Visible fits, newest first; optionally one niche's or one user's. Cursor = created_at. */
export async function listFits(
  db: Database,
  {
    niche,
    userId,
    before,
    limit = 24,
    includeHidden = false,
  }: { niche?: string; userId?: string; before?: Date; limit?: number; includeHidden?: boolean },
): Promise<FitWithAuthor[]> {
  const conditions = [
    includeHidden ? undefined : eq(fits.status, "visible"),
    niche ? arrayContains(fits.niches, [niche]) : undefined,
    userId ? eq(fits.userId, userId) : undefined,
    // Public lists leave out friends-only people; their profile decides who sees them.
    userId ? undefined : not(friendsOnlyOwner(fits.userId)),
    before ? lt(fits.createdAt, before) : undefined,
  ].filter((condition) => condition !== undefined)
  const rows = await db
    .select(withAuthor)
    .from(fits)
    .innerJoin(profiles, eq(profiles.id, fits.userId))
    .where(and(...conditions))
    .orderBy(desc(fits.createdAt))
    .limit(limit)
  return rows.map(({ fit, handle }) => ({ ...fit, handle }))
}

export async function getFit(db: Database, id: string): Promise<FitWithAuthor | null> {
  const [row] = await db
    .select(withAuthor)
    .from(fits)
    .innerJoin(profiles, eq(profiles.id, fits.userId))
    .where(eq(fits.id, id))
    .limit(1)
  return row ? { ...row.fit, handle: row.handle } : null
}

export async function savedFits(
  db: Database,
  userId: string,
  limit = 48,
): Promise<FitWithAuthor[]> {
  const rows = await db
    .select(withAuthor)
    .from(fitSaves)
    .innerJoin(fits, eq(fits.id, fitSaves.fitId))
    .innerJoin(profiles, eq(profiles.id, fits.userId))
    .where(and(eq(fitSaves.userId, userId), eq(fits.status, "visible")))
    .orderBy(desc(fitSaves.createdAt))
    .limit(limit)
  return rows.map(({ fit, handle }) => ({ ...fit, handle }))
}

/** Which of these fits the viewer has liked / saved. */
export async function viewerState(db: Database, userId: string, fitIds: readonly string[]) {
  if (fitIds.length === 0) return { liked: new Set<string>(), saved: new Set<string>() }
  const ids = [...fitIds]
  const [liked, saved] = await Promise.all([
    db
      .select({ id: fitLikes.fitId })
      .from(fitLikes)
      .where(and(eq(fitLikes.userId, userId), inArray(fitLikes.fitId, ids))),
    db
      .select({ id: fitSaves.fitId })
      .from(fitSaves)
      .where(and(eq(fitSaves.userId, userId), inArray(fitSaves.fitId, ids))),
  ])
  return { liked: new Set(liked.map((row) => row.id)), saved: new Set(saved.map((row) => row.id)) }
}

/** Like or unlike; the counter moves only when the like row actually changed. */
export async function setLike(
  db: Database,
  fitId: string,
  userId: string,
  liked: boolean,
): Promise<number> {
  return db.transaction(async (tx) => {
    const changed = liked
      ? await tx
          .insert(fitLikes)
          .values({ fitId, userId })
          .onConflictDoNothing()
          .returning({ id: fitLikes.fitId })
      : await tx
          .delete(fitLikes)
          .where(and(eq(fitLikes.fitId, fitId), eq(fitLikes.userId, userId)))
          .returning({ id: fitLikes.fitId })
    const delta = changed.length > 0 ? (liked ? 1 : -1) : 0
    const [row] = await tx
      .update(fits)
      .set({ likeCount: sql`greatest(0, ${fits.likeCount} + ${delta})` })
      .where(eq(fits.id, fitId))
      .returning({ likeCount: fits.likeCount })
    return row?.likeCount ?? 0
  })
}

export async function setSave(
  db: Database,
  fitId: string,
  userId: string,
  saved: boolean,
): Promise<void> {
  if (saved) await db.insert(fitSaves).values({ fitId, userId }).onConflictDoNothing()
  else await db.delete(fitSaves).where(and(eq(fitSaves.fitId, fitId), eq(fitSaves.userId, userId)))
}

/**
 * One report per person per fit. Reaching `autoHideAt` distinct reports hides
 * the fit until an admin looks at it.
 */
export async function reportFit(
  db: Database,
  fitId: string,
  reporterId: string,
  reason: string,
  autoHideAt: number,
): Promise<{ hidden: boolean; imagePath: string | null }> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(fitReports)
      .values({ fitId, reporterId, reason })
      .onConflictDoNothing()
      .returning({ id: fitReports.fitId })
    if (inserted.length === 0) return { hidden: false, imagePath: null }
    const [row] = await tx
      .update(fits)
      .set({
        reportCount: sql`${fits.reportCount} + 1`,
        status: sql`case when ${fits.reportCount} + 1 >= ${autoHideAt} then 'hidden' else ${fits.status} end`,
      })
      .where(eq(fits.id, fitId))
      .returning({ status: fits.status, imagePath: fits.imagePath })
    return { hidden: row?.status === "hidden", imagePath: row?.imagePath ?? null }
  })
}

/** Moderation queue: anything reported, or hidden, newest first. */
export async function moderationQueue(db: Database, limit = 100): Promise<FitWithAuthor[]> {
  const rows = await db
    .select(withAuthor)
    .from(fits)
    .innerJoin(profiles, eq(profiles.id, fits.userId))
    .where(sql`${fits.reportCount} > 0 or ${fits.status} = 'hidden'`)
    .orderBy(desc(fits.reportCount), desc(fits.createdAt))
    .limit(limit)
  return rows.map(({ fit, handle }) => ({ ...fit, handle }))
}

/**
 * Hide or restore a fit. Restoring also clears its reports, so a fit an admin
 * judged fine isn't re-hidden by the next single report.
 */
export async function setFitStatus(
  db: Database,
  fitId: string,
  status: FitStatus,
): Promise<string | null> {
  return db.transaction(async (tx) => {
    if (status === "visible") await tx.delete(fitReports).where(eq(fitReports.fitId, fitId))
    const [row] = await tx
      .update(fits)
      .set(status === "visible" ? { status, reportCount: 0 } : { status })
      .where(eq(fits.id, fitId))
      .returning({ imagePath: fits.imagePath })
    return row?.imagePath ?? null
  })
}

export async function deleteFit(
  db: Database,
  fitId: string,
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .delete(fits)
    .where(and(eq(fits.id, fitId), eq(fits.userId, userId)))
    .returning({ imagePath: fits.imagePath })
  return row?.imagePath ?? null
}

/** Recent visible fits for a niche, newer than `since` (feed freshness). */
export async function recentFitCount(db: Database, since: Date): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(fits)
    .where(and(eq(fits.status, "visible"), gt(fits.createdAt, since)))
  return row?.count ?? 0
}
