/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown"
}

/** Consistent JSON envelope for route handlers. */
export type ApiResponse<T> =
  { success: true; data: T } | { success: false; error: string; code?: string }

export function apiOk<T>(data: T, status = 200): Response {
  return Response.json({ success: true, data } satisfies ApiResponse<T>, { status })
}

/** `code` is a stable machine-readable reason (e.g. "capped") the UI can branch on. */
export function apiError(error: string, status: number, code?: string): Response {
  const body: ApiResponse<never> = code
    ? { success: false, error, code }
    : { success: false, error }
  return Response.json(body, { status })
}
