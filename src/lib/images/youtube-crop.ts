/**
 * YouTube's hqdefault thumbnails are 4:3 frames with black bars: a normal
 * video is letterboxed (bars top and bottom), a Short is pillarboxed (bars
 * left and right, the video only 202 of 480 pixels wide). These zooms hide
 * the bars in the frames we show them in.
 */
const YT_HQ = /^https:\/\/i\.ytimg\.com\/vi\/[^/]+\/hqdefault\.jpg/

/** Portrait frames (3:4, 4:5): either kind's bars fall just outside at 1.34×. */
const PORTRAIT = "scale-[1.34]"
/** Landscape frames: letterbox bars are already cropped; a Short needs 480/202 ≈ 2.4×. */
const LANDSCAPE_SHORT = "scale-[2.4]"

export type CropFrame = "portrait" | "landscape" | "portrait-then-landscape"

export function isYouTubeThumb(url: string | null | undefined): boolean {
  return typeof url === "string" && YT_HQ.test(url)
}

/** The zoom class for a thumbnail in a frame ("" for anything that isn't a YouTube hqdefault). */
export function youtubeCrop(
  url: string | null | undefined,
  { short = false, frame }: { short?: boolean; frame: CropFrame },
): string {
  if (!isYouTubeThumb(url)) return ""
  if (frame === "portrait") return PORTRAIT
  if (frame === "landscape") return short ? LANDSCAPE_SHORT : ""
  // Portrait on phones, landscape from md up (the issue cover). Literal strings: Tailwind
  // only generates classes it can find whole in the source.
  return short ? "scale-[1.34] md:scale-[2.4]" : "scale-[1.34] md:scale-100"
}
