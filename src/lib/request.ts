/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown"
}

/** Consistent JSON envelope for route handlers. */
export type ApiResponse<T> = { success: true; data: T } | { success: false; error: string }

export function apiOk<T>(data: T, status = 200): Response {
  return Response.json({ success: true, data } satisfies ApiResponse<T>, { status })
}

export function apiError(error: string, status: number): Response {
  return Response.json({ success: false, error } satisfies ApiResponse<never>, { status })
}
