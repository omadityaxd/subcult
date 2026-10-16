import "server-only"
import { z } from "zod"
import { getDb } from "@/db"
import type { Database } from "@/db/create-db"
import { getProfile } from "@/db/fit-repository"
import { type SocialRepository, createSocialRepository } from "@/db/social-repository"
import { sameOrigin } from "@/lib/fits/route-helpers"
import { handleSchema } from "@/lib/fits/schema"
import { getLimiter } from "@/lib/rate-limit"
import { apiError } from "@/lib/request"
import { type Viewer, getViewer } from "@/lib/supabase/server"

export interface SocialContext {
  viewer: Viewer
  /** Your own handle: following and being followed need one. */
  handle: string
  db: Database
  social: SocialRepository
}

/** Same-origin, signed in with a handle, database up, rate-limited per user. */
export async function socialContext(request: Request): Promise<SocialContext | Response> {
  if (request.method !== "GET" && !sameOrigin(request)) {
    return apiError("cross-site request refused", 403, "forbidden")
  }
  const viewer = await getViewer()
  if (!viewer) return apiError("sign in first", 401, "unauthenticated")
  const db = getDb()
  if (!db) return apiError("friends aren't available", 503, "unavailable")
  const limit = await getLimiter("social", 60, "10 m", { durable: true }).limit(viewer.id)
  if (!limit.success) return apiError("slow down a little", 429, "rate-limited")
  const profile = await getProfile(db, viewer.id)
  if (!profile) return apiError("pick a handle first", 409, "needs-handle")
  return { viewer, handle: profile.handle, db, social: createSocialRepository(db) }
}

export const handleBody = z.object({ handle: handleSchema })

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
