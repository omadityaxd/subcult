import { connection } from "next/server"
import { getDb } from "@/db"
import { getProfile } from "@/db/fit-repository"
import { getViewer } from "@/lib/supabase/server"
import { AccountData } from "./account-data"

/** Me → your data, for signed-in people only (guests' data lives on their device). */
export async function AccountDataSection() {
  await connection()
  const viewer = await getViewer()
  if (!viewer) return null
  const db = getDb()
  const profile = db ? await getProfile(db, viewer.id).catch(() => null) : null
  return <AccountData handle={profile?.handle ?? null} />
}
