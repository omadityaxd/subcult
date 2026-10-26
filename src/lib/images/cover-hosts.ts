/**
 * Hosts whose cover images go through the image optimizer (WebP, a
 * ~750px variant on phones, cached). Only the issue cover uses it: one image
 * per edition, so it stays well inside the free tier. Anything else on the
 * page uses the CDN loader (lib/images/cdn.ts). Also next.config's
 * images.remotePatterns, so the optimizer refuses every other host.
 */
export interface CoverHostPattern {
  protocol: "https"
  /** Exact host, or "*.example.com" for any subdomain. */
  hostname: string
  /** Path prefix, ending in "/**". */
  pathname: string
}

export const COVER_IMAGE_HOSTS: readonly CoverHostPattern[] = [
  // Posted fits (Supabase Storage, public bucket).
  { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
  // Artist portraits and album art.
  { protocol: "https", hostname: "i.scdn.co", pathname: "/image/**" },
  { protocol: "https", hostname: "*.mzstatic.com", pathname: "/**" },
  // Grails, video stills, editorial photos.
  { protocol: "https", hostname: "i.ebayimg.com", pathname: "/**" },
  { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" },
  { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
  { protocol: "https", hostname: "images.pexels.com", pathname: "/photos/**" },
]

function hostMatches(pattern: string, host: string): boolean {
  if (!pattern.startsWith("*.")) return host === pattern
  const suffix = pattern.slice(1) // ".example.com"
  return host.endsWith(suffix) && host.length > suffix.length
}

/** Can the optimizer serve this cover? (Same rule as next.config's remotePatterns.) */
export function isOptimizableCover(src: string): boolean {
  let url: URL
  try {
    url = new URL(src)
  } catch {
    return false
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username || url.password) return false
  return COVER_IMAGE_HOSTS.some(
    (pattern) =>
      hostMatches(pattern.hostname, url.hostname) &&
      url.pathname.startsWith(pattern.pathname.replace(/\*\*$/, "")),
  )
}

/** Phones get at most this wide a cover: sharp enough under the headline, a fraction of the bytes. */
export const COVER_MOBILE_MAX_WIDTH = 750

/** The srcset entries a phone may pick from ("url 640w, url 750w, …" → those ≤ max, else the smallest). */
export function capSrcSet(srcSet: string, maxWidth: number): string {
  const entries = srcSet
    .split(/,\s+/)
    .map((entry) => ({ entry, width: Number(entry.trim().split(/\s+/)[1]?.replace(/w$/, "")) }))
    .filter(({ width }) => Number.isFinite(width) && width > 0)
  const kept = entries.filter(({ width }) => width <= maxWidth)
  const smallest = [...entries].sort((a, b) => a.width - b.width).slice(0, 1)
  return (kept.length > 0 ? kept : smallest).map(({ entry }) => entry.trim()).join(", ")
}
