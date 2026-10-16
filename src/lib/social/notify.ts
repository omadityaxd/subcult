import "server-only"
import { getDb } from "@/db"
import { createAlertsRepository } from "@/db/alerts-repository"
import { createSocialRepository } from "@/db/social-repository"

/** Bounded fan-out: a viral account's post shouldn't stall the request. */
const MAX_NOTIFIED = 500

/**
 * "@x posted a fit" for their followers who want friend alerts. Friends-only
 * posters only reach mutual follows (the people who can see the fit).
 */
export async function notifyFollowersOfFit(
  userId: string,
  handle: string,
  fitId: string,
  imageUrl: string,
): Promise<number> {
  const db = getDb()
  if (!db) return 0
  const social = createSocialRepository(db)
  const alerts = createAlertsRepository(db)
  const [followers, settings, following] = await Promise.all([
    social.followers(userId),
    social.settings(userId),
    social.following(userId),
  ])
  const mutual = new Set(following.map((p) => p.id))
  const audience = followers
    .filter((p) => settings.visibility === "public" || mutual.has(p.id))
    .slice(0, MAX_NOTIFIED)
  let sent = 0
  for (const follower of audience) {
    if (!(await alerts.prefs(follower.id)).friends) continue
    const added = await alerts.notify(follower.id, {
      type: "friend",
      title: `@${handle} posted a fit`,
      url: `/fits/${fitId}`,
      imageUrl,
      dedupeKey: `fit:${fitId}`,
    })
    if (added) sent += 1
  }
  return sent
}
