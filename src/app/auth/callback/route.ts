import { NextResponse } from "next/server"
import { safeNext } from "@/lib/auth/redirect"
import { errorMessage, log } from "@/lib/log"
import { createSupabaseServer } from "@/lib/supabase/server"

/** GET /auth/callback?code=…&next=/me → exchanges the OAuth / magic-link code for a session cookie. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const next = safeNext(url.searchParams.get("next"))
  const code = url.searchParams.get("code")
  const supabase = await createSupabaseServer()
  if (!code || !supabase) return NextResponse.redirect(new URL("/login?error=missing", url.origin))
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    log.warn("auth.callback_failed", { error: errorMessage(error) })
    return NextResponse.redirect(
      new URL(`/login?error=exchange&next=${encodeURIComponent(next)}`, url.origin),
    )
  }
  return NextResponse.redirect(new URL(next, url.origin))
}
