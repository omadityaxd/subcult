import { describe, expect, it } from "vitest"
import { MAX_SOUND_FRAMES, storyFrames, storyKind } from "./story-mix"
import type { FeedItem } from "./types"

const item = (id: string, over: Partial<FeedItem> = {}): FeedItem => ({
  id,
  source: "subcult",
  type: "pin",
  title: id,
  subtitle: null,
  imageUrl: `https://img/${id}.jpg`,
  url: `https://example.com/${id}`,
  publishedAt: null,
  score: 1,
  meta: {},
  ...over,
})
const track = (id: string) => item(id, { source: "spotify", type: "track" })
const tea = (id: string) => item(id, { source: "news", type: "article" })
const fit = (id: string) => item(id, { type: "fit" })
const grail = (id: string) => item(id, { source: "ebay", type: "product" })

const kinds = (frames: FeedItem[]) => frames.map(storyKind)

describe("storyFrames", () => {
  it("never has more than 2 Sound frames, however much music there is", () => {
    const frames = storyFrames([...Array.from({ length: 12 }, (_, i) => track(`t${i}`)), fit("f")])
    expect(kinds(frames).filter((k) => k === "sound").length).toBeLessThanOrEqual(MAX_SOUND_FRAMES)
  })

  it("fails loudly if the cap is ever raised past 2", () => {
    expect(MAX_SOUND_FRAMES).toBeLessThanOrEqual(2)
  })

  it("includes Tea, Fit and Grail frames whenever the niche has them", () => {
    const frames = storyFrames([
      track("t1"),
      track("t2"),
      track("t3"),
      tea("n1"),
      fit("f1"),
      grail("g1"),
    ])
    expect(kinds(frames)).toEqual(expect.arrayContaining(["tea", "fit", "grail"]))
  })

  it("keeps a headline frame even without an image", () => {
    const frames = storyFrames(
      [tea("n1"), track("t1")].map((i, k) => (k === 0 ? { ...i, imageUrl: null } : i)),
    )
    expect(kinds(frames)).toContain("tea")
  })

  it("gives a thin niche a shorter story rather than filling it with tracks", () => {
    const frames = storyFrames([track("t1"), track("t2"), track("t3"), track("t4"), fit("f1")])
    expect(frames).toHaveLength(3)
    expect(kinds(frames)).toEqual(["fit", "sound", "sound"])
  })

  it("adds a this-or-that poll when two looks of the same kind exist", () => {
    const frames = storyFrames([fit("f1"), fit("f2"), fit("f3"), track("t1")])
    const poll = frames.find((f) => storyKind(f) === "poll")
    expect(poll?.meta).toMatchObject({ aId: "f2", bId: "f3" })
    // The poll's two looks don't also appear as their own frames.
    expect(frames.map((f) => f.id)).not.toContain("f2")
  })

  it("never polls tracks", () => {
    const frames = storyFrames([track("t1"), track("t2")])
    expect(kinds(frames)).not.toContain("poll")
  })
})
