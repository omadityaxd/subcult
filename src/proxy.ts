import { createServerClient } from "@supabase/ssr"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { type NextRequest, NextResponse } from "next/server"
import { ADMIN_AUTH_CHALLENGE, isAuthorizedBasic } from "@/lib/admin-auth"

/** Wrong admin passwords allowed per IP per 10 minutes before /admin locks for that IP. */
const ADMIN_FAILURES = 10
let adminFailures: Ratelimit | null | undefined

function failureLimiter(): Ratelimit | null {
  if (adminFailures !== undefined) return adminFailures
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  adminFailures =
    url && token
      ? new Ratelimit({
          redis: new Redis({ url, token }),
          limiter: Ratelimit.slidingWindow(ADMIN_FAILURES, "10 m"),
          prefix: "subcult:rl:admin-fail",
        })
      : null
  return adminFailures
}

/**
 * Gate /admin behind HTTP Basic auth (password = ADMIN_SECRET). With no
 * secret configured the admin area doesn't exist (404). Repeated wrong
 * passwords from one IP lock it out for a while.
 */
async function adminGate(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return new NextResponse(null, { status: 404 })
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const limiter = failureLimiter()
  if (limiter) {
    const { remaining } = await limiter.getRemaining(ip).catch(() => ({ remaining: 1 }))
    if (remaining <= 0) return new NextResponse("too many attempts", { status: 429 })
  }
  if (isAuthorizedBasic(request.headers.get("authorization"), secret)) return NextResponse.next()
  if (limiter && request.headers.get("authorization"))
    await limiter.limit(ip).catch(() => undefined)
  return new NextResponse("admin only", {
    status: 401,
    headers: { "WWW-Authenticate": ADMIN_AUTH_CHALLENGE },
  })
}

/**
 * Keeps the Supabase session fresh: getClaims() refreshes an expiring token
 * and the new cookies go to both the rendering request and the browser.
 */
async function refreshSession(request: NextRequest): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  let response = NextResponse.next({ request })
  if (!url || !key) return response
  // Only signed-in visitors carry a Supabase cookie; everyone else skips the network.
  if (!request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-"))) return response

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(toSet, headers) {
        for (const { name, value } of toSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options)
        for (const [header, value] of Object.entries(headers ?? {}))
          response.headers.set(header, value)
      },
    },
  })
  await supabase.auth.getClaims()
  return response
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (request.nextUrl.pathname.startsWith("/admin")) return adminGate(request)
  return refreshSession(request)
}

export const config = {
  // Pages and API routes; never static assets or images.
  matcher: [
    "/((?!_next/static|_next/image|icons/|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|svg|ico)$).*)",
  ],
}
