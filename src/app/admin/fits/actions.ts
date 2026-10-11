"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { z } from "zod"
import { getDb } from "@/db"
import { setFitStatus } from "@/db/fit-repository"
import { FIT_STATUSES } from "@/db/schema"
import { isAuthorizedBasic } from "@/lib/admin-auth"
import { env } from "@/lib/env"
import { quarantinePhoto } from "@/lib/fits/server"
import { log } from "@/lib/log"

const inputSchema = z.object({ id: z.string().uuid(), status: z.enum(FIT_STATUSES) })

/** Hide / restore a fit. Re-checks admin auth: server actions are public endpoints. */
export async function setFitStatusAction(formData: FormData): Promise<void> {
  const requestHeaders = await headers()
  if (!isAuthorizedBasic(requestHeaders.get("authorization"), env.ADMIN_SECRET)) {
    throw new Error("unauthorized")
  }
  const input = inputSchema.parse({ id: formData.get("id"), status: formData.get("status") })
  const db = getDb()
  if (!db) throw new Error("DATABASE_URL not configured")
  const path = await setFitStatus(db, input.id, input.status)
  if (path) await quarantinePhoto(path, input.status === "hidden")
  log.info("admin.fit.status", input)
  revalidatePath("/admin/fits")
}
