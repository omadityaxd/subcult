/**
 * Content Security Policy: only what subcult really loads. Scripts from us,
 * Spotify's and YouTube's player APIs, the Spotify SDK and PostHog; frames
 * only for the Spotify and YouTube embeds; audio previews from iTunes.
 *
 * Inline scripts stay allowed: Next streams its data inline, and nonces
 * would force every page to render dynamically (no static shell). The
 * origin allow-list is where this policy does its work.
 */
export function contentSecurityPolicy({ dev = false }: { dev?: boolean } = {}): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(dev ? ["'unsafe-eval'"] : []),
      "https://open.spotify.com",
      "https://sdk.scdn.co",
      "https://www.youtube.com",
      "https://s.ytimg.com",
      "https://*.posthog.com",
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
    // data: is the audio engine's silent unlock clip (a few bytes of WAV).
    "media-src": [
      "'self'",
      "blob:",
      "data:",
      "https://*.itunes.apple.com",
      "https://*.mzstatic.com",
    ],
    "connect-src": [
      "'self'",
      "https://*.supabase.co",
      "wss://*.supabase.co",
      "https://*.posthog.com",
      "https://api.spotify.com",
      "https://*.spotify.com",
      "wss://*.spotify.com",
      ...(dev ? ["ws:"] : []),
    ],
    "frame-src": [
      "https://open.spotify.com",
      "https://sdk.scdn.co",
      "https://www.youtube-nocookie.com",
      "https://www.youtube.com",
    ],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  }
  if (!dev) directives["upgrade-insecure-requests"] = []
  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(" "))
    .join("; ")
}

/** Every response's security headers. */
export function securityHeaders({ dev = false }: { dev?: boolean } = {}) {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy({ dev }) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    },
  ]
}
