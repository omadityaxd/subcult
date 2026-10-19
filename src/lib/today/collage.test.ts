import { describe, expect, it } from "vitest"
import type { FeedItem } from "@/lib/feed/types"
import { collageTiles } from "./collage"

const fit = (id: string, imageUrl: string, meta: FeedItem["meta"] = {}): FeedItem => ({
  id,
  source: "subcult",
  type: "fit",
  title: id,
  subtitle: null,
  imageUrl,
  url: "/",
  publishedAt: null,
  score: 1,
  meta,
})

const PORTRAIT = "https://i.scdn.co/image/ab6761610000e5eb35033cc5f61a8529cb15f1de"
const niches = [
  { slug: "rage", name: "rage", palette: ["#000", "#f0f"] },
  { slug: "vamp", name: "vamp", palette: ["#000", "#f00"] },
]

describe("collageTiles", () => {
  it("uses a sharp fit and an artist portrait", () => {
    const tiles = collageTiles({
      fits: [fit("f", "https://a.com/fit.jpg", { imgW: 1200, nicheName: "vamp" })],
      portraits: [{ name: "Ken Carson", imageUrl: PORTRAIT, niche: "rage" }],
      coverUrl: null,
      niches,
    })
    expect(tiles.map((t) => t.kind)).toEqual(["fit", "portrait"])
  })

  it("never uses an upscaled thumbnail, falling back to generative covers", () => {
    const tiles = collageTiles({
      fits: [fit("yt", "https://i.ytimg.com/vi/x/hqdefault.jpg")],
      portraits: [],
      coverUrl: null,
      niches,
    })
    expect(tiles.map((t) => t.kind)).toEqual(["niche", "niche"])
  })

  it("never repeats the cover", () => {
    const tiles = collageTiles({
      fits: [],
      portraits: [{ name: "Ken Carson", imageUrl: PORTRAIT, niche: "rage" }],
      coverUrl: PORTRAIT.replace("e5eb", "5174"),
      niches,
    })
    expect(tiles.every((t) => t.kind === "niche")).toBe(true)
  })
})
