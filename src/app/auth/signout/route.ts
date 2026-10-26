import { NextResponse } from "next/server"
import { PERSONAL_COOKIES } from "@/lib/auth/personal-data"
import { sameOrigin } from "@/lib/fits/route-helpers"
import { createSupabaseServer } from "@/lib/supabase/server"

/** POST /auth/signout → ends the session (a form post, so it can't be triggered by a link). */
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return new Response("cross-site request refused", { status: 403 })
  const supabase = await createSupabaseServer()
  await supabase?.auth.signOut()
  const response = NextResponse.redirect(new URL("/", request.url), { status: 303 })
  // The next issue is a guest's, not the last person's (the page clears the device too).
  for (const name of PERSONAL_COOKIES) response.cookies.set(name, "", { path: "/", maxAge: 0 })
  return response
}
