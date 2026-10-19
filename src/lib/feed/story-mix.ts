import type { FeedItem } from "./types"

/** A story never has more music than this: subcult isn't a Spotify skin. */
export const MAX_SOUND_FRAMES = 2
export const MAX_VIDEO_FRAMES = 1
export const STORY_FRAMES = 10

export type StoryKind = "sound" | "tea" | "fit" | "grail" | "visual" | "video" | "poll"

/** Which part of the issue a frame belongs to. */
export function storyKind(item: FeedItem): StoryKind {
  if (item.meta.poll === true) return "poll"
  if (item.source === "spotify" || item.type === "track" || item.type === "release") return "sound"
  if (item.type === "playlist") return "sound"
  if (item.source === "news") return "tea"
  if (item.type === "fit" || item.meta.fit === true || item.meta.fitCheck === true) return "fit"
  if (item.source === "ebay" || item.type === "product") return "grail"
  if (item.type === "video") return "video"
  return "visual"
}

/** Kinds a "this or that" can pit against each other: looks and pieces, never people. */
const POLLABLE = new Set<StoryKind>(["fit", "grail", "visual"])

/** "This or that": two pictures of the same kind, tap the one you'd pick. */
export function pollFrame(a: FeedItem, b: FeedItem): FeedItem {
  return {
    id: `poll:${a.id}|${b.id}`,
    source: "subcult",
    type: "prompt",
    title: "This or that?",
    subtitle: null,
    imageUrl: a.imageUrl,
    url: a.url,
    publishedAt: null,
    score: 0,
    meta: {
      poll: true,
      aId: a.id,
      aTitle: a.title,
      aImage: a.imageUrl,
      aShort: a.meta.short === true,
      bId: b.id,
      bTitle: b.title,
      bImage: b.imageUrl,
      bShort: b.meta.short === true,
    },
  }
}

/**
 * A niche's story frames. Tea, Fit and Grail each get a frame when the niche
 * has them; Sound is capped at MAX_SOUND_FRAMES and never fills empty
 * space (a thin niche gets a shorter story, not more tracks); one "this or
 * that" poll when there are two looks to compare.
 */
export function storyFrames(items: readonly FeedItem[], limit = STORY_FRAMES): FeedItem[] {
  const pictured = items.filter((item) => item.imageUrl)
  const of = (kind: StoryKind) => pictured.filter((item) => storyKind(item) === kind)
  const tea = [...of("tea"), ...items.filter((i) => !i.imageUrl && storyKind(i) === "tea")]
  const sound = of("sound").slice(0, MAX_SOUND_FRAMES)
  const used = new Set<string>()
  const pick = (item: FeedItem | undefined) => {
    if (!item || used.has(item.id)) return []
    used.add(item.id)
    return [item]
  }

  const fit = pick(of("fit")[0])
  const grail = pick(of("grail")[0])
  const lead = pick(tea[0])
  const pollable = pictured.filter((item) => POLLABLE.has(storyKind(item)) && !used.has(item.id))
  const pair = pollable.find((a, i) =>
    pollable.slice(i + 1).some((b) => storyKind(b) === storyKind(a)),
  )
  const partner = pair
    ? pollable.find((b) => b !== pair && storyKind(b) === storyKind(pair))
    : undefined
  const poll = pair && partner ? [pollFrame(pair, partner)] : []
  if (pair && partner) used.add(pair.id).add(partner.id)

  let videos = 0
  const rest = pictured.filter((item) => {
    const kind = storyKind(item)
    if (used.has(item.id) || kind === "sound" || kind === "poll") return false
    if (kind === "video") return ++videos <= MAX_VIDEO_FRAMES
    return true
  })
  const [s1, s2] = sound
  const ordered = [
    ...fit,
    ...(s1 ? [s1] : []),
    ...lead,
    ...grail,
    ...poll,
    ...(s2 ? [s2] : []),
    ...rest,
  ]
  return ordered.slice(0, limit)
}

/**
 * The story's "now playing" sticker for a frame: hidden when the frame is
 * itself a track (the plugg story showed "No Date" as the frame and again as
 * the sticker), or when the background song is the one on the frame.
 */
export function stickerFor<M extends { title: string }>(
  frame: FeedItem | null | undefined,
  music: M | null | undefined,
): M | null {
  if (!music || !frame) return music ?? null
  if (storyKind(frame) === "sound") return null
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
  return same(frame.title, music.title) ? null : music
}
