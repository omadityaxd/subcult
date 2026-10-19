import sharp from "sharp"
import type { ImageFacts } from "./facts"

export type { ImageFacts } from "./facts"
export { DUPLICATE_DISTANCE, hammingDistance, isSameImage } from "./facts"

const FOCUS_SIZE = 64

/**
 * dHash: 9×8 greyscale, one bit per horizontal neighbour pair (is the left
 * pixel brighter?). Robust to resizing and recompression, cheap to compare.
 */
async function differenceHash(input: Buffer): Promise<string> {
  const pixels = await sharp(input).greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer()
  let bits = ""
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = pixels[row * 9 + col] ?? 0
      const right = pixels[row * 9 + col + 1] ?? 0
      bits += left > right ? "1" : "0"
    }
  }
  let hex = ""
  for (let i = 0; i < 64; i += 4) hex += Number.parseInt(bits.slice(i, i + 4), 2).toString(16)
  return hex
}

/**
 * Where to anchor the image when a frame crops it: sharp's attention
 * strategy picks the square crop that keeps the subject (faces, clothes),
 * and its offset becomes a CSS object-position (0 = left/top, 1 = right/
 * bottom) on the axis that overflows. The crop offsets are reliable for
 * every format (the attention point itself isn't, for JPEGs).
 */
async function focusPoint(input: Buffer, width: number, height: number) {
  const { info } = await sharp(input)
    .resize(FOCUS_SIZE, FOCUS_SIZE, { fit: "cover", position: sharp.strategy.attention })
    .toBuffer({ resolveWithObject: true })
  const scale = FOCUS_SIZE / Math.min(width, height)
  const overflowX = Math.round(width * scale) - FOCUS_SIZE
  const overflowY = Math.round(height * scale) - FOCUS_SIZE
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  return {
    focusX: overflowX > 0 ? clamp(-(info.cropOffsetLeft ?? 0) / overflowX) : 0.5,
    focusY: overflowY > 0 ? clamp(-(info.cropOffsetTop ?? 0) / overflowY) : 0.5,
  }
}

export async function analyzeImage(input: Buffer): Promise<ImageFacts> {
  const meta = await sharp(input).metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  if (width === 0 || height === 0) throw new Error("not an image")
  const [hash, focus] = await Promise.all([differenceHash(input), focusPoint(input, width, height)])
  return { width, height, hash, ...focus }
}
