import { type NextRequest, NextResponse } from "next/server"
import { ADMIN_AUTH_CHALLENGE, isAuthorizedBasic } from "@/lib/admin-auth"

/**
 * Gate /admin behind HTTP Basic auth (password = ADMIN_SECRET). With no
 * secret configured the admin area doesn't exist (404).
 */
export function proxy(request: NextRequest): NextResponse {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return new NextResponse(null, { status: 404 })
  if (isAuthorizedBasic(request.headers.get("authorization"), secret)) return NextResponse.next()
  return new NextResponse("admin only", {
    status: 401,
    headers: { "WWW-Authenticate": ADMIN_AUTH_CHALLENGE },
  })
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
}
