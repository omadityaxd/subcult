import "server-only"
import type { Database } from "@/db/create-db"
import { getProfile } from "@/db/fit-repository"
import { type Viewer, createSupabaseServer } from "@/lib/supabase/server"

/**
 * Is this signed-in viewer still a real account? A deleted account's access
 * token stays valid until it expires, so routes that write or export check
 * this rather than trusting the token alone.
 *
 * A profile means yes (deleting an account removes it first). Without one
 * (a new account that hasn't picked a handle, or a deleted one) Supabase
 * Auth decides: getUser() asks the Auth server, which refuses tokens of
 * deleted users.
 */
export async function isLiveAccount(db: Database, viewer: Viewer): Promise<boolean> {
  if (await getProfile(db, viewer.id)) return true
  const supabase = await createSupabaseServer()
  if (!supabase) return false
  const { data, error } = await supabase.auth.getUser()
  return !error && data.user?.id === viewer.id
}

export const ACCOUNT_GONE = "This account no longer exists. Sign in again."
