"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

let client: SupabaseClient | null = null

/** Browser Supabase client (singleton), for sign-in flows only; data goes through our API. */
export function getSupabaseBrowser(url: string, publishableKey: string): SupabaseClient {
  client ??= createBrowserClient(url, publishableKey)
  return client
}
