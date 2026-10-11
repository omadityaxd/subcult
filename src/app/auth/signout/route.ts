import { NextResponse } from "next/server"
import { sameOrigin } from "@/lib/fits/route-helpers"
import { createSupabaseServer } from "@/lib/supabase/server"

/** POST /auth/signout → ends the session (a form post, so it can't be triggered by a link). */
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return new Response("cross-site request refused", { status: 403 })
  const supabase = await createSupabaseServer()
  await supabase?.auth.signOut()
  return NextResponse.redirect(new URL("/", request.url), { status: 303 })
}
