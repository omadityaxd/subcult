/**
 * Image facts and how to compare them. Pure (no sharp): safe for client
 * code that only reads facts already attached to feed items.
 */

/** What we learn from an image once, at ingest (cached by URL). */
export interface ImageFacts {
  width: number
  height: number
  /** 64-bit difference hash, 16 hex chars: near-identical images have nearby hashes. */
  hash: string
  /** CSS object-position that keeps the subject in frame (0–1 from the left / top). */
  focusX: number
  focusY: number
}

/** Hashes this close (of 64 bits) are the same picture: re-encodes, resizes, small crops. */
export const DUPLICATE_DISTANCE = 10

/** Bits that differ between two hashes (0–64). */
export function hammingDistance(a: string, b: string): number {
  let bits = 0
  for (let i = 0; i < 16; i++) {
    let x = Number.parseInt(a[i] ?? "0", 16) ^ Number.parseInt(b[i] ?? "0", 16)
    while (x > 0) {
      bits += x & 1
      x >>= 1
    }
  }
  return bits
}

/**
 * Video thumbnails of re-uploads of the same footage drift a little further
 * (recompression, overlays): a slightly looser match, only between videos.
 */
export const VIDEO_DUPLICATE_DISTANCE = 12

export function isSameImage(a: string, b: string, maxDistance = DUPLICATE_DISTANCE): boolean {
  return hammingDistance(a, b) <= maxDistance
}
