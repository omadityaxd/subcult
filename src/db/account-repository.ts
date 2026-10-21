import { eq, inArray, or } from "drizzle-orm"
import type { Database } from "./create-db"
import {
  alertPrefs,
  fitLikes,
  fitReports,
  fitSaves,
  fits,
  grailSearches,
  notifications,
  profileSettings,
  profiles,
  pushSubscriptions,
  tasteSignals,
  userBlocks,
  userFollows,
  votes,
} from "./schema"

/**
 * Everything subcult holds about one account, as plain rows: what "export
 * my data" downloads. Push subscriptions are endpoints only (their keys
 * are the browser's, not ours to hand out).
 */
export async function exportAccount(db: Database, userId: string) {
  const [
    profile,
    settings,
    myFits,
    likes,
    saves,
    reports,
    signals,
    pushes,
    inbox,
    prefs,
    hunts,
    following,
    followers,
    blocked,
    myVotes,
  ] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.id, userId)),
    db.select().from(profileSettings).where(eq(profileSettings.userId, userId)),
    db.select().from(fits).where(eq(fits.userId, userId)),
    db.select().from(fitLikes).where(eq(fitLikes.userId, userId)),
    db.select().from(fitSaves).where(eq(fitSaves.userId, userId)),
    db.select().from(fitReports).where(eq(fitReports.reporterId, userId)),
    db.select().from(tasteSignals).where(eq(tasteSignals.userId, userId)),
    db
      .select({ endpoint: pushSubscriptions.endpoint, createdAt: pushSubscriptions.createdAt })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId)),
    db.select().from(notifications).where(eq(notifications.userId, userId)),
    db.select().from(alertPrefs).where(eq(alertPrefs.userId, userId)),
    db.select().from(grailSearches).where(eq(grailSearches.userId, userId)),
    db.select().from(userFollows).where(eq(userFollows.followerId, userId)),
    db.select().from(userFollows).where(eq(userFollows.followeeId, userId)),
    db.select().from(userBlocks).where(eq(userBlocks.blockerId, userId)),
    db.select().from(votes).where(eq(votes.voter, userId)),
  ])
  return {
    profile: profile[0] ?? null,
    settings: settings[0] ?? null,
    fits: myFits,
    likes,
    saves,
    reports,
    tasteSignals: signals,
    pushSubscriptions: pushes,
    notifications: inbox,
    alertPrefs: prefs[0] ?? null,
    grailHunts: hunts,
    following,
    followers,
    blocked,
    votes: myVotes,
  }
}

/**
 * Deletes every row tied to the account in one transaction (their fits take
 * other people's likes, saves and reports of them along). Returns the fit
 * photos' storage paths, which the caller removes from storage.
 */
export async function deleteAccountData(db: Database, userId: string): Promise<string[]> {
  return db.transaction(async (tx) => {
    const myFits = await tx
      .select({ id: fits.id, imagePath: fits.imagePath })
      .from(fits)
      .where(eq(fits.userId, userId))
    const fitIds = myFits.map((fit) => fit.id)
    if (fitIds.length > 0) {
      await tx.delete(fitLikes).where(inArray(fitLikes.fitId, fitIds))
      await tx.delete(fitSaves).where(inArray(fitSaves.fitId, fitIds))
      await tx.delete(fitReports).where(inArray(fitReports.fitId, fitIds))
      await tx.delete(fits).where(inArray(fits.id, fitIds))
    }
    await tx.delete(fitLikes).where(eq(fitLikes.userId, userId))
    await tx.delete(fitSaves).where(eq(fitSaves.userId, userId))
    await tx.delete(fitReports).where(eq(fitReports.reporterId, userId))
    await tx.delete(tasteSignals).where(eq(tasteSignals.userId, userId))
    await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId))
    await tx.delete(notifications).where(eq(notifications.userId, userId))
    await tx.delete(alertPrefs).where(eq(alertPrefs.userId, userId))
    await tx.delete(grailSearches).where(eq(grailSearches.userId, userId))
    await tx
      .delete(userFollows)
      .where(or(eq(userFollows.followerId, userId), eq(userFollows.followeeId, userId)))
    await tx
      .delete(userBlocks)
      .where(or(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, userId)))
    await tx.delete(votes).where(eq(votes.voter, userId))
    await tx.delete(profileSettings).where(eq(profileSettings.userId, userId))
    await tx.delete(profiles).where(eq(profiles.id, userId))
    return myFits.map((fit) => fit.imagePath)
  })
}
