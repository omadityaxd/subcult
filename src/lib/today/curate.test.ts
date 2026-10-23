import { describe, expect, it } from "vitest"
import type { FeedItem } from "@/lib/feed/types"
import type { ImageFacts } from "@/lib/images/analyze"
import { curateCandidates } from "./curate"
import type { Candidates } from "./edition"

const item = (id: string, imageUrl: string | null, meta: FeedItem["meta"] = {}): FeedItem => ({
  id,
  source: "news",
  type: "article",
  title: id,
  subtitle: null,
  imageUrl,
  url: `https://x.com/${id}`,
  publishedAt: null,
  score: 1,
  meta,
})

const empty: Candidates = {
  digest: [],
  soundPicks: [],
  drops: [],
  headlines: [],
  archive: [],
  fits: [],
  rising: [],
  friends: [],
  more: [],
}

const facts = (hash: string): ImageFacts => ({
  width: 1600,
  height: 1200,
  hash,
  focusX: 0.5,
  focusY: 0.2,
})

describe("curateCandidates", () => {
  const video = (id: string, videoId: string, thumb = videoId): FeedItem => ({
    ...item(id, `https://i.ytimg.com/vi/${thumb}/maxresdefault.jpg`),
    source: "youtube",
    type: "video",
    url: `https://www.youtube.com/watch?v=${videoId}`,
  })

  it("keeps one copy of a video that arrives twice under different ids", () => {
    const fits = [
      video("youtube:fit:abc", "abc"),
      { ...video("youtube:abc", "abc"), imageUrl: null },
    ]
    const out = curateCandidates(
      { ...empty, fits, more: [video("more:abc", "abc", "other")] },
      new Map(),
    )
    expect(out.fits.map((i) => i.id)).toEqual(["youtube:fit:abc"])
    expect(out.more).toHaveLength(0)
  })

  it("treats re-uploads of the same footage as one video (thumbnails 11 bits apart)", () => {
    const a = video("a", "aaa")
    const b = video("b", "bbb")
    const known = new Map([
      [a.imageUrl!, facts("0d8c0c0f0d9d9596")],
      [b.imageUrl!, facts("8d8d4d0d8d850796")],
    ])
    expect(curateCandidates({ ...empty, fits: [a, b] }, known).fits.map((i) => i.id)).toEqual(["a"])
  })

  it("keeps photos 11 bits apart: only video thumbnails get the looser match", () => {
    const a = item("a", "https://img.example/a.jpg")
    const b = item("b", "https://img.example/b.jpg")
    const known = new Map([
      [a.imageUrl!, facts("0d8c0c0f0d9d9596")],
      [b.imageUrl!, facts("8d8d4d0d8d850796")],
    ])
    expect(curateCandidates({ ...empty, more: [a, b] }, known).more).toHaveLength(2)
  })

  it("shows each picture once across the whole issue", () => {
    const album = "https://i.scdn.co/image/ab67616d0000b2734eba3a1d0a6f9a7a1b2c3d4e"
    const albumSmall = "https://i.scdn.co/image/ab67616d00001e024eba3a1d0a6f9a7a1b2c3d4e"
    const out = curateCandidates(
      {
        ...empty,
        fits: [item("fit", "https://a.com/fit.jpg")],
        drops: [item("drop-1", album), item("drop-2", albumSmall)],
        more: [item("more", "https://b.com/copy-of-fit.jpg")],
      },
      new Map([
        ["https://a.com/fit.jpg", facts("aaaaaaaaaaaaaaaa")],
        ["https://b.com/copy-of-fit.jpg", facts("aaaaaaaaaaaaaaab")],
      ]),
    )
    expect(out.fits.map((i) => i.id)).toEqual(["fit"])
    expect(out.drops.map((i) => i.id)).toEqual(["drop-1"])
    expect(out.more).toEqual([])
  })

  it("keeps a Tea story whose borrowed photo repeats, on its palette", () => {
    const photo = "https://i.scdn.co/image/ab6761610000e5eb35033cc5f61a8529cb15f1de"
    const story = item("story", photo, { imageFallback: true, overlay: "#000,#fff" })
    const out = curateCandidates(
      { ...empty, fits: [item("fit", photo)], headlines: [story], digest: [story] },
      new Map(),
    )
    expect(out.headlines).toHaveLength(1)
    expect(out.headlines[0]?.imageUrl).toBeNull()
    expect(out.digest[0]?.imageUrl).toBeNull()
  })

  it("carries the subject's position onto kept images", () => {
    const out = curateCandidates(
      { ...empty, fits: [item("fit", "https://a.com/fit.jpg")] },
      new Map([["https://a.com/fit.jpg", facts("aaaaaaaaaaaaaaaa")]]),
    )
    expect(out.fits[0]?.meta).toMatchObject({ focusX: 0.5, focusY: 0.2, imgW: 1600 })
  })
})
