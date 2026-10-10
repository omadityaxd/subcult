"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { z } from "zod"
import { getDb } from "@/db"
import { setNicheStatus } from "@/db/trend-repository"
import { isAuthorizedBasic } from "@/lib/admin-auth"
import { env } from "@/lib/env"
import { log } from "@/lib/log"
import { NICHE_STATUSES } from "@/lib/niches/lifecycle"

const inputSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,64}$/),
  status: z.enum(NICHE_STATUSES),
})

/**
 * Hide / restore / archive a niche. Server actions are public endpoints, so
 * this re-checks admin auth itself instead of trusting the page that rendered it.
 */
export async function setNicheStatusAction(formData: FormData): Promise<void> {
  const requestHeaders = await headers()
  if (!isAuthorizedBasic(requestHeaders.get("authorization"), env.ADMIN_SECRET)) {
    throw new Error("unauthorized")
  }
  const input = inputSchema.parse({
    slug: formData.get("slug"),
    status: formData.get("status"),
  })
  const db = getDb()
  if (!db) throw new Error("DATABASE_URL not configured")

  const changed = await setNicheStatus(db, input.slug, input.status)
  log.info("admin.niche.status", { ...input, changed })
  revalidatePath("/admin/niches")
}
