import "server-only"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { env } from "@/lib/env"

/** True when Supabase Auth is configured; every auth surface hides otherwise. */
export const authEnabled = Boolean(
  env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
)

/**
 * A Supabase client bound to this request's cookies. Create one per request,
 * never share it. In Server Components cookies can't be written, so token
 * refreshes are left to the proxy (src/proxy.ts).
 */
export async function createSupabaseServer() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null
  const cookieStore = await cookies()
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(toSet) {
          try {
            for (const { name, value, options } of toSet) cookieStore.set(name, value, options)
          } catch {
            // Called from a Server Component: the proxy refreshes the session instead.
          }
        },
      },
    },
  )
}

export interface Viewer {
  id: string
  email: string | null
}

/**
 * The signed-in user, from verified JWT claims (getClaims checks the token's
 * signature; getSession alone would trust whatever the cookie says).
 */
export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createSupabaseServer()
  if (!supabase) return null
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (error || !claims?.sub) return null
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null }
}
