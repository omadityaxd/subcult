import { getDb } from "@/db"
import { getProfile } from "@/db/fit-repository"
import { handleSchema } from "@/lib/fits/schema"
import { getLimiter } from "@/lib/rate-limit"
import { apiError } from "@/lib/request"
import { renderMatchCard } from "@/lib/social/match-card"
import { profileView } from "@/lib/social/server"
import { getViewer } from "@/lib/supabase/server"

/**
 * GET /u/{handle}/match/card → the 1080×1920 share card (PNG). Needs your
 * session and a profile you're allowed to see; the client shares the file.
 */
export async function GET(_request: Request, { params }: RouteContext<"/u/[handle]/match/card">) {
  const { handle } = await params
  if (!handleSchema.safeParse(handle).success) return apiError("bad handle", 400, "invalid-input")
  const viewer = await getViewer()
  const db = getDb()
  if (!viewer || !db) return apiError("sign in first", 401, "unauthenticated")
  const limit = await getLimiter("match-card", 20, "10 m").limit(viewer.id)
  if (!limit.success) return apiError("slow down a little", 429, "rate-limited")
  const [view, me] = await Promise.all([profileView(handle), getProfile(db, viewer.id)])
  if (!view?.match || !me) return apiError("no match to share", 404, "not-found")
  const card = await renderMatchCard(me.handle, view.handle, view.match)
  card.headers.set("Cache-Control", "private, no-store")
  return card
}
