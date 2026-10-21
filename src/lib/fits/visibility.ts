import "server-only"
import type { Database } from "@/db/create-db"
import { canView, createSocialRepository } from "@/db/social-repository"

/**
 * Can this viewer see this fit? Its author always can. Anyone else needs
 * it visible (not hidden by reports), and needs the author's privacy to
 * allow it: friends-only means mutual follows, and a block either way
 * hides it. Every by-id read and action goes through here.
 */
export async function canSeeFit(
  db: Database,
  fit: { userId: string; status: string },
  viewerId: string | null,
): Promise<boolean> {
  if (viewerId !== null && fit.userId === viewerId) return true
  if (fit.status !== "visible") return false
  const social = createSocialRepository(db)
  const [settings, relation] = await Promise.all([
    social.settings(fit.userId),
    social.relation(viewerId, fit.userId),
  ])
  return canView(settings.visibility, relation)
}
