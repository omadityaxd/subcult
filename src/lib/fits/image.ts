import "server-only"
import sharp from "sharp"

/** Raw upload ceiling (the client compresses first; this is the hard stop). */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
/** Longest side of the stored image. */
export const MAX_EDGE = 1440
/** Refuse decompression bombs: 25 megapixels covers any phone photo. */
const MAX_INPUT_PIXELS = 25_000_000
/**
 * Common web formats only (the phone converts HEIC to WebP before upload;
 * fewer native decoders = less attack surface).
 */
const ALLOWED_INPUT = new Set(["jpeg", "png", "webp"])

// One decode at a time per instance, no decoded-image cache: bounded memory.
sharp.concurrency(1)
sharp.cache(false)

export class FitImageError extends Error {}

/**
 * Every fit is re-encoded on the server, whatever the client did: rotated
 * upright from its EXIF orientation, resized, saved as WebP. sharp writes no
 * metadata unless asked, so EXIF, GPS location and camera details are gone.
 */
export async function processFitImage(
  bytes: Uint8Array,
): Promise<{ data: Buffer; width: number; height: number }> {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new FitImageError("Photos can be up to 8 MB.")
  }
  const image = sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
  const meta = await image.metadata().catch(() => null)
  if (!meta?.format || !ALLOWED_INPUT.has(meta.format)) {
    throw new FitImageError("That doesn't look like a photo (JPEG, PNG or WebP).")
  }
  const { data, info } = await image
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}
