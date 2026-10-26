import "server-only"
import { after } from "next/server"
import sharp from "sharp"
import { errorMessage, log } from "@/lib/log"
import { getCacheStore } from "@/lib/music/server"
import { isOptimizableCover } from "./cover-hosts"

/** A 16px-wide WebP is ~300 bytes inline: enough for a blurred colour field. */
const BLUR_WIDTH = 16
const FETCH_TIMEOUT_MS = 4000
const MAX_SOURCE_BYTES = 15_000_000
const KEEP_S = 30 * 24 * 3600
const MISS_S = 24 * 3600

const keyFor = (src: string) => `subcult:cover-blur:v1:${src}`

/** "data:image/webp;base64,…" for a tiny blurred copy of the image. Exported for tests. */
export async function makeBlurDataUrl(bytes: ArrayBuffer): Promise<string> {
  const webp = await sharp(Buffer.from(bytes))
    .resize({ width: BLUR_WIDTH })
    .blur(1)
    .webp({ quality: 40 })
    .toBuffer()
  return `data:image/webp;base64,${webp.toString("base64")}`
}

async function generate(src: string): Promise<void> {
  const store = getCacheStore()
  try {
    const response = await fetch(src, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    const length = Number(response.headers.get("content-length") ?? 0)
    if (!response.ok || length > MAX_SOURCE_BYTES) throw new Error(`source ${response.status}`)
    const bytes = await response.arrayBuffer()
    if (bytes.byteLength > MAX_SOURCE_BYTES) throw new Error("source too large")
    await store.set(keyFor(src), await makeBlurDataUrl(bytes), KEEP_S)
  } catch (error) {
    // Don't retry a broken image on every request: the cover just has no placeholder.
    await store.set(keyFor(src), "", MISS_S).catch(() => undefined)
    log.warn("cover_blur.failed", { error: errorMessage(error) })
  }
}

/**
 * The cover's blur placeholder, made once per image when it first becomes a
 * cover. Never on the critical path: a cache read here, and on a miss the
 * placeholder is made after the response, ready for the next reader.
 */
export async function coverBlur(src: string | null): Promise<string | null> {
  if (!src || !isOptimizableCover(src)) return null
  const stored = await getCacheStore()
    .get(keyFor(src))
    .catch(() => undefined)
  if (typeof stored === "string") return stored || null
  after(() => generate(src))
  return null
}
