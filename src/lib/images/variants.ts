/**
 * What an image URL already tells us: its best variant, its width (when
 * the host encodes it), and a canonical key so two sizes of one picture
 * count as the same picture.
 */

/** Minimum real width per slot: a cover is printed big, a card isn't. */
export const MIN_WIDTH = { hero: 1200, cover: 1200, card: 600 } as const
export type ImageSlot = keyof typeof MIN_WIDTH

const SPOTIFY_WIDTH: Record<string, number> = {
  // Artist portraits
  ab6761610000e5eb: 640,
  ab67616100005174: 320,
  ab6761610000f178: 160,
  // Album covers
  ab67616d0000b273: 640,
  ab67616d00001e02: 300,
  ab67616d00004851: 64,
}
const SPOTIFY_BEST: Record<string, string> = {
  ab67616100005174: "ab6761610000e5eb",
  ab6761610000f178: "ab6761610000e5eb",
  ab67616d00001e02: "ab67616d0000b273",
  ab67616d00004851: "ab67616d0000b273",
}
const YOUTUBE_WIDTH: Record<string, number> = {
  default: 120,
  mqdefault: 320,
  hqdefault: 480,
  sddefault: 640,
  hq720: 1280,
  maxresdefault: 1280,
}

const SPOTIFY = /^https:\/\/i\.scdn\.co\/image\/([0-9a-f]{16})([0-9a-f]+)$/
const MZSTATIC = /\/(\d+)x(\d+)bb\./
const EBAY = /s-l(\d+)\./
const YOUTUBE = /^https:\/\/i\.ytimg\.com\/vi\/([^/]+)\/([a-z0-9]+)\.jpg/

function parse(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

/** The highest-resolution variant the source serves (YouTube is upgraded by a probe instead). */
export function bestVariant(url: string): string {
  const spotify = SPOTIFY.exec(url)
  if (spotify) {
    const better = SPOTIFY_BEST[spotify[1] ?? ""]
    return better ? url.replace(spotify[1] ?? "", better) : url
  }
  const parsed = parse(url)
  if (!parsed) return url
  if (parsed.hostname.endsWith("mzstatic.com")) return url.replace(MZSTATIC, "/1200x1200bb.")
  if (parsed.hostname.endsWith("ebayimg.com")) return url.replace(EBAY, "s-l1600.")
  return url
}

/** The width the URL itself promises, or null when only the bytes can tell. */
export function knownWidth(url: string): number | null {
  const spotify = SPOTIFY.exec(url)
  if (spotify) return SPOTIFY_WIDTH[spotify[1] ?? ""] ?? null
  const youtube = YOUTUBE.exec(url)
  if (youtube) return YOUTUBE_WIDTH[youtube[2] ?? ""] ?? null
  const parsed = parse(url)
  if (!parsed) return null
  if (parsed.hostname.endsWith("mzstatic.com")) {
    const size = MZSTATIC.exec(url)
    return size ? Number(size[1]) : null
  }
  return null
}

/**
 * One key per picture, whatever size was requested: Spotify's variants
 * share an id, iTunes and eBay encode only the size, YouTube thumbnails are
 * one video. Everything else: the URL without its query.
 */
export function canonicalImage(url: string): string {
  const spotify = SPOTIFY.exec(url)
  if (spotify) return `spotify:${spotify[2]}`
  const youtube = YOUTUBE.exec(url)
  if (youtube) return `youtube:${youtube[1]}`
  const parsed = parse(url)
  if (!parsed) return url
  const path = parsed.pathname.replace(MZSTATIC, "/NxNbb.").replace(EBAY, "s-lN.")
  return `${parsed.hostname}${path}`
}
