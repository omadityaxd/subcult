import { NextResponse } from "next/server"
import { getDb } from "@/db"
import { getProfile } from "@/db/fit-repository"
import { safeNext } from "@/lib/auth/redirect"
import { errorMessage, log } from "@/lib/log"
import { createSupabaseServer } from "@/lib/supabase/server"

/**
 * GET /auth/callback?code=…&next=/me → exchanges the OAuth / magic-link code
 * for a session cookie. First sign-in (no handle yet) goes through /welcome.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const next = safeNext(url.searchParams.get("next"))
  const code = url.searchParams.get("code")
  const supabase = await createSupabaseServer()
  if (!code || !supabase) return NextResponse.redirect(new URL("/login?error=missing", url.origin))
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    log.warn("auth.callback_failed", { error: errorMessage(error) })
    return NextResponse.redirect(
      new URL(`/login?error=exchange&next=${encodeURIComponent(next)}`, url.origin),
    )
  }
  // New here (no handle yet): handle → vibe check → niches → first issue.
  const db = getDb()
  const profile = db && data.user ? await getProfile(db, data.user.id).catch(() => null) : undefined
  if (profile === null) {
    return NextResponse.redirect(new URL(`/welcome?next=${encodeURIComponent(next)}`, url.origin))
  }
  return NextResponse.redirect(new URL(next, url.origin))
}
