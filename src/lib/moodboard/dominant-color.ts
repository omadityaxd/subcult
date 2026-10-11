import "server-only"
import sharp from "sharp"
import { rgbToHex } from "@/lib/color"

/**
 * Dominant color of an image, computed once at ingest (then cached with the
 * moodboard). Only known image CDNs are fetched, with a size cap and timeout,
 * so this can't be pointed at arbitrary URLs.
 */
const ALLOWED_HOSTS = [
  "i.scdn.co",
  "mzstatic.com",
  "i.ytimg.com",
  "images.are.na",
  "d2w9rnfcy7mm78.cloudfront.net",
  "images.unsplash.com",
  "images.pexels.com",
]
const MAX_BYTES = 6 * 1024 * 1024
const TIMEOUT_MS = 6_000
const SAMPLE = 24
/** 4 bits per channel: 4,096 buckets, enough to separate "red" from "rust". */
const BUCKET_SHIFT = 4

export function isAllowedImageUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url)
    return (
      protocol === "https:" &&
      ALLOWED_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))
    )
  } catch {
    return false
  }
}

/**
 * Most common color bucket in a 24×24 thumbnail, averaged within the
 * bucket. Near-white and near-black pixels only win if nothing else exists,
 * so a product shot on a white background still reads as its product.
 */
export function dominantFromPixels(pixels: Uint8Array, channels: number): string | null {
  const buckets = new Map<
    number,
    { count: number; r: number; g: number; b: number; neutral: boolean }
  >()
  for (let i = 0; i + 2 < pixels.length; i += channels) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    const key = ((r >> BUCKET_SHIFT) << 8) | ((g >> BUCKET_SHIFT) << 4) | (b >> BUCKET_SHIFT)
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const neutral = max > 240 && min > 230 ? true : max < 18
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0, neutral }
    bucket.count += 1
    bucket.r += r
    bucket.g += g
    bucket.b += b
    buckets.set(key, bucket)
  }
  const ranked = [...buckets.values()].sort((a, b) => b.count - a.count)
  const pick = ranked.find((bucket) => !bucket.neutral) ?? ranked[0]
  if (!pick) return null
  return rgbToHex({ r: pick.r / pick.count, g: pick.g / pick.count, b: pick.b / pick.count })
}

export async function dominantColor(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  if (!isAllowedImageUrl(url)) return null
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!response.ok) return null
    const length = Number(response.headers.get("content-length") ?? 0)
    if (length > MAX_BYTES) return null
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > MAX_BYTES) return null
    const { data, info } = await sharp(bytes)
      .resize(SAMPLE, SAMPLE, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    return dominantFromPixels(new Uint8Array(data), info.channels)
  } catch {
    // Unreadable or slow image: it simply won't match color filters.
    return null
  }
}
