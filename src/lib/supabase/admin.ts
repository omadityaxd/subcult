import "server-only"
import { type SupabaseClient, createClient } from "@supabase/supabase-js"
import { env } from "@/lib/env"

let admin: SupabaseClient | null | undefined

/**
 * Service client for Storage writes. Users never write to the fits buckets
 * themselves (no storage policies grant it), so every stored photo is one the
 * server re-encoded. Null when SUPABASE_SECRET_KEY isn't set: posting is off.
 */
export function getStorageAdmin(): SupabaseClient | null {
  if (admin !== undefined) return admin
  admin =
    env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SECRET_KEY
      ? createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null
  return admin
}

export const postingEnabled = () => getStorageAdmin() !== null
