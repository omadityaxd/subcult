import "server-only"
import { createHash } from "node:crypto"
import { mapWithConcurrency } from "@/lib/concurrency"
import { errorMessage, log } from "@/lib/log"
import { getRedis } from "@/lib/redis"
import { type ImageFacts, analyzeImage } from "./analyze"
import { cdnImageUrl } from "./cdn"
import type { FactsMap } from "./curate"
import { bestVariant, knownWidth } from "./variants"

const CACHE_PREFIX = "subcult:img:v1:"
const FOUND_TTL = 30 * 86_400
const MISS_TTL = 86_400
const FETCH_TIMEOUT_MS = 5000
const MAX_BYTES = 8 * 1024 * 1024
/** Hashing and focus need few pixels: known CDNs serve a small variant. */
const ANALYZE_WIDTH = 400
const CONCURRENCY = 6
const DEFAULT_BUDGET_MS = 2500

const keyFor = (url: string) => CACHE_PREFIX + createHash("sha1").update(url).digest("hex")

/** Only public https images: no IP literals or local hosts (feeds are untrusted input). */
export function isFetchableImageUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== "https:") return false
  const host = parsed.hostname
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) return false
  return host.includes(".")
}

async function download(url: string): Promise<Buffer | null> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "image/*" },
    redirect: "follow",
  })
  if (!response.ok) return null
  if (!(response.headers.get("content-type") ?? "").startsWith("image/")) return null
  if (Number(response.headers.get("content-length") ?? 0) > MAX_BYTES) return null
  const bytes = Buffer.from(await response.arrayBuffer())
  return bytes.byteLength > MAX_BYTES ? null : bytes
}

/** Measures one image (fresh, uncached). The real width comes from the URL when the host encodes it. */
async function measure(url: string): Promise<ImageFacts | null> {
  if (!isFetchableImageUrl(url)) return null
  const promised = knownWidth(bestVariant(url))
  // A small variant is enough for hash and focus, but only when the URL states the real width;
  // otherwise measure the image as served (a resized copy would understate it).
  const bytes = await download(promised ? cdnImageUrl(url, ANALYZE_WIDTH) : url)
  if (!bytes) return null
  const facts = await analyzeImage(bytes)
  if (!promised) return facts
  // Analyzed from a small variant: scale the size back up to the biggest one served.
  const scale = promised / facts.width
  return { ...facts, width: promised, height: Math.round(facts.height * scale) }
}

/** One image's facts, cached for a month (misses for a day). */
export async function imageFacts(url: string): Promise<ImageFacts | null> {
  const redis = getRedis()
  const key = keyFor(url)
  if (redis) {
    const hit = await redis.get<ImageFacts | "miss">(key).catch(() => null)
    if (hit === "miss") return null
    if (hit) return hit
  }
  const facts = await measure(url).catch((error: unknown) => {
    log.warn("image.analyze_failed", { url: url.slice(0, 120), error: errorMessage(error) })
    return null
  })
  if (redis) {
    await redis
      .set(key, facts ?? "miss", { ex: facts ? FOUND_TTL : MISS_TTL })
      .catch(() => undefined)
  }
  return facts
}

/**
 * Facts for many images within a time budget: whatever finishes in time is
 * returned (cached ones are instant), so a view never waits on a slow host.
 */
export async function imageFactsFor(
  urls: readonly (string | null | undefined)[],
  budgetMs = DEFAULT_BUDGET_MS,
): Promise<FactsMap> {
  const unique = [...new Set(urls.filter((u): u is string => Boolean(u)))]
  const out = new Map<string, ImageFacts | null>()
  const work = mapWithConcurrency(unique, CONCURRENCY, async (url) => {
    out.set(url, await imageFacts(url))
  })
  await Promise.race([work, new Promise((resolve) => setTimeout(resolve, budgetMs))])
  return out
}

/**
 * YouTube's 1280px thumbnail when the video has one (not all do): the only
 * YouTube image sharp enough for a cover.
 */
export async function youtubeMaxres(url: string): Promise<string | null> {
  const match = /^https:\/\/i\.ytimg\.com\/vi\/([^/]+)\//.exec(url)
  if (!match) return null
  const maxres = `https://i.ytimg.com/vi/${match[1]}/maxresdefault.jpg`
  const facts = await imageFacts(maxres)
  // YouTube answers 404 when there's no maxres; a real one is 1280 wide.
  return facts && facts.width >= 1280 ? maxres : null
}
