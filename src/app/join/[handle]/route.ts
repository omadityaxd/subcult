import { NextResponse } from "next/server"
import { handleSchema } from "@/lib/fits/schema"
import { INVITE_COOKIE, INVITE_MAX_AGE_S } from "@/lib/social/founding"

/**
 * GET /join/{handle} → the invite link. Remembers who invited you (for the
 * founding badge when you pick a handle) and drops you into setup.
 */
export async function GET(request: Request, { params }: RouteContext<"/join/[handle]">) {
  const { handle } = await params
  const response = NextResponse.redirect(
    new URL(`/start?from=${encodeURIComponent(handle)}`, request.url),
  )
  if (handleSchema.safeParse(handle).success) {
    response.cookies.set(INVITE_COOKIE, handle, {
      maxAge: INVITE_MAX_AGE_S,
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: new URL(request.url).protocol === "https:",
    })
  }
  return response
}
