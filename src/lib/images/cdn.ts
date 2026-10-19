/**
 * Right-sized remote images without an image optimizer: the CDNs we show
 * already serve resized variants, so a next/image loader maps each srcset
 * width to the nearest variant at or above it. Unknown hosts pass through.
 */

/** Spotify's fixed variants: artist portraits and album covers, by width. */
const SPOTIFY_ARTIST: readonly [number, string][] = [
  [160, "ab6761610000f178"],
  [320, "ab67616100005174"],
  [640, "ab6761610000e5eb"],
]
const SPOTIFY_ALBUM: readonly [number, string][] = [
  [64, "ab67616d00004851"],
  [300, "ab67616d00001e02"],
  [640, "ab67616d0000b273"],
]
const EBAY_SIZES = [225, 300, 400, 500, 640, 800, 960, 1200, 1600]

const atLeast = <T>(variants: readonly [number, T][], width: number): T =>
  (variants.find(([w]) => w >= width) ?? variants[variants.length - 1])[1]

function spotify(src: string, width: number): string {
  for (const table of [SPOTIFY_ARTIST, SPOTIFY_ALBUM]) {
    const current = table.find(([, code]) => src.includes(code))
    if (current) return src.replace(current[1], atLeast(table, width))
  }
  return src
}

export function cdnImageUrl(src: string, width: number): string {
  let url: URL
  try {
    url = new URL(src)
  } catch {
    return src
  }
  const host = url.hostname
  if (host === "i.scdn.co") return spotify(src, width)
  if (host.endsWith("mzstatic.com")) {
    const size = Math.min(1200, Math.max(100, Math.round(width / 50) * 50))
    return src.replace(/\/\d+x\d+bb\./, `/${size}x${size}bb.`)
  }
  if (host.endsWith("ebayimg.com")) {
    const size = EBAY_SIZES.find((s) => s >= width) ?? 1600
    return src.replace(/s-l\d+\./, `s-l${size}.`)
  }
  if (host === "images.unsplash.com" || host === "images.pexels.com") {
    url.searchParams.set("w", String(width))
    if (host === "images.pexels.com") url.searchParams.set("auto", "compress")
    return url.toString()
  }
  return src
}

/** Whether a host serves sized variants at all (otherwise there's nothing to pick between). */
export function isResizable(src: string): boolean {
  return cdnImageUrl(src, 64) !== cdnImageUrl(src, 1600)
}

/**
 * next/image `loader`: called once per srcset width. When the right variant
 * is the one already in `src`, a `#w=` fragment marks the width (never sent to
 * the server, so the cache is shared) and keeps next/image from warning that
 * the loader ignores width.
 */
export const cdnLoader = ({ src, width }: { src: string; width: number }): string => {
  const url = cdnImageUrl(src, width)
  return url === src ? `${src}#w=${width}` : url
}
