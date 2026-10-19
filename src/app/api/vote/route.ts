import { z } from "zod"
import { getDb } from "@/db"
import { VOTE_CHOICES } from "@/db/schema"
import { castVote, tallies } from "@/db/vote-repository"
import { sameOrigin } from "@/lib/fits/route-helpers"
import { errorMessage, log } from "@/lib/log"
import { getLimiter } from "@/lib/rate-limit"
import { apiError, apiOk, clientIp } from "@/lib/request"
import { getViewer } from "@/lib/supabase/server"
import { VOTE_TARGET, type VoteTally } from "@/lib/votes/split"

const MAX_TARGETS = 24

const voteSchema = z.object({
  target: z.string().regex(VOTE_TARGET),
  choice: z.enum(VOTE_CHOICES),
  /** Guests vote as their device (a random id kept on it). */
  device: z.string().uuid().optional(),
})

const listSchema = z.object({
  targets: z
    .string()
    .max(MAX_TARGETS * 260)
    .transform((v) => v.split(",").filter(Boolean))
    .pipe(z.array(z.string().regex(VOTE_TARGET)).min(1).max(MAX_TARGETS)),
})

/**
 * POST casts Cop or Drop (or a poll pick) on an item, never a person, and
 * returns the item's real counts. GET returns counts for up to 24 items.
 */
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return apiError("cross-site request refused", 403, "forbidden")
  const limit = await getLimiter("vote", 120, "10 m", { durable: true }).limit(
    clientIp(request.headers),
  )
  if (!limit.success) return apiError("slow down a little", 429, "rate-limited")
  const parsed = voteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return apiError("invalid vote", 400, "invalid-input")
  const db = getDb()
  if (!db) return apiError("not available right now", 503, "unavailable")
  const viewer = await getViewer().catch(() => null)
  const voter = viewer?.id ?? (parsed.data.device ? `device:${parsed.data.device}` : null)
  if (!voter) return apiError("no voter", 400, "invalid-input")
  const { target, choice } = parsed.data
  // A poll takes a/b, everything else cop/drop.
  const isPoll = target.startsWith("poll:")
  if (isPoll !== (choice === "a" || choice === "b")) {
    return apiError("that choice doesn't fit this item", 400, "invalid-input")
  }
  try {
    await castVote(db, { targetId: target, voter, choice })
    const tally: VoteTally = (await tallies(db, [target])).get(target) ?? {}
    return apiOk({ target, tally })
  } catch (error) {
    log.error("vote.failed", { error: errorMessage(error) })
    return apiError("couldn't save that vote", 500, "internal")
  }
}

export async function GET(request: Request): Promise<Response> {
  const parsed = listSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return apiError("pass ?targets=id,id", 400, "invalid-input")
  const db = getDb()
  if (!db) return apiOk({ tallies: {} as Record<string, VoteTally> })
  const found = await tallies(db, parsed.data.targets)
  return apiOk({ tallies: Object.fromEntries(found) })
}
