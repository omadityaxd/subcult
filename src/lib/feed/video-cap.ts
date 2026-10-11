import type { FeedItem } from "./types"

/** subcult is music-first: video is at most this share of a story or the For You feed. */
export const MAX_VIDEO_SHARE = 0.2

/**
 * Keeps order and drops the lowest-ranked videos so they are at most `share`
 * of the final list (1 in 5 by default), *after* trimming to `limit` items.
 * With no other content, no videos are shown rather than a wall of them.
 */
export function capVideos(
  items: readonly FeedItem[],
  share = MAX_VIDEO_SHARE,
  limit = Infinity,
): FeedItem[] {
  const others = items.filter((item) => item.type !== "video").length
  const length = Math.min(limit, others + Math.floor((others * share) / (1 - share)))
  const allowed = Math.floor(length * share)
  let videos = 0
  return items.filter((item) => item.type !== "video" || videos++ < allowed).slice(0, length)
}

/** Story order: Spotify first (it's a music app), then other visuals, then headlines. */
export function storyOrder(items: readonly FeedItem[], limit = Infinity): FeedItem[] {
  const music = items.filter((item) => item.source === "spotify" && item.imageUrl)
  const visual = items.filter((item) => item.source !== "spotify" && item.imageUrl)
  const text = items.filter((item) => !item.imageUrl)
  return capVideos([...music, ...visual, ...text], MAX_VIDEO_SHARE, limit)
}
