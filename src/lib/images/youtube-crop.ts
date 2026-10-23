/**
 * YouTube's hqdefault thumbnails are 4:3 frames with black bars: a normal
 * video is letterboxed (bars top and bottom), a Short is pillarboxed (bars
 * left and right, the video only 202 of 480 pixels wide). A Short's 1280px
 * maxresdefault is 16:9 with the video in the middle 405 pixels. These
 * zooms hide the bars in the frames we show them in.
 */
const YT_HQ = /^https:\/\/i\.ytimg\.com\/vi\/[^/]+\/hqdefault\.jpg/
const YT_MAX = /^https:\/\/i\.ytimg\.com\/vi\/[^/]+\/maxresdefault\.jpg/

/** Portrait frames (3:4, 4:5): either kind's bars fall just outside at 1.34×. */
const PORTRAIT = "scale-[1.34]"
/** Landscape frames: letterbox bars are already cropped; a Short needs 480/202 ≈ 2.4×. */
const LANDSCAPE_SHORT = "scale-[2.4]"
/** A Short's 1280px frame: a 4:5 crop shows 576 of 1280 px, the video is 405 (×1.42). */
const PORTRAIT_SHORT_MAX = "scale-[1.42]"
/** …and a landscape frame shows all 1280 (×3.16). */
const LANDSCAPE_SHORT_MAX = "scale-[3.16]"

/** Of a Short's frame, the share that's video: hqdefault 202/480, maxres 405/1280. */
const SHORT_VIDEO_SHARE = { hq: 202 / 480, max: 405 / 1280 }

export type CropFrame = "portrait" | "landscape" | "portrait-then-landscape"

export function isYouTubeThumb(url: string | null | undefined): boolean {
  return typeof url === "string" && YT_HQ.test(url)
}

const isYouTubeMaxres = (url: string | null | undefined): url is string =>
  typeof url === "string" && YT_MAX.test(url)

/** The zoom class for a thumbnail in a frame ("" for anything that has no bars to hide). */
export function youtubeCrop(
  url: string | null | undefined,
  { short = false, frame }: { short?: boolean; frame: CropFrame },
): string {
  // Literal strings throughout: Tailwind only generates classes it finds whole in the source.
  if (isYouTubeMaxres(url)) {
    if (!short) return ""
    if (frame === "portrait") return PORTRAIT_SHORT_MAX
    if (frame === "landscape") return LANDSCAPE_SHORT_MAX
    return "scale-[1.42] md:scale-[3.16]"
  }
  if (!isYouTubeThumb(url)) return ""
  if (frame === "portrait") return PORTRAIT
  if (frame === "landscape") return short ? LANDSCAPE_SHORT : ""
  // Portrait on phones, landscape from md up (the issue cover).
  return short ? "scale-[1.34] md:scale-[2.4]" : "scale-[1.34] md:scale-100"
}

/**
 * How many pixels across are actually video: a Short's thumbnail is mostly
 * blurred side bars, so its sharpness is the video column's width.
 */
export function videoFrameWidth({
  imageUrl,
  short,
  width,
}: {
  imageUrl: string | null | undefined
  short: boolean
  width: number
}): number {
  if (!short) return width
  if (isYouTubeMaxres(imageUrl)) return Math.round(width * SHORT_VIDEO_SHARE.max)
  if (isYouTubeThumb(imageUrl)) return Math.round(width * SHORT_VIDEO_SHARE.hq)
  return width
}
