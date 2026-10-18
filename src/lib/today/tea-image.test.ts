import { describe, expect, it } from "vitest"
import type { FeedItem } from "@/lib/feed/types"
import { entityPhoto, overlayPalette, withTeaImage } from "./tea-image"

const story = (imageUrl: string | null): FeedItem => ({
  id: "news:article:1",
  source: "news",
  type: "article",
  title: "A headline",
  subtitle: "Outlet",
  imageUrl,
  url: "https://example.com/a",
  publishedAt: null,
  score: 1,
  meta: { nicheSlug: "vamp" },
})

describe("withTeaImage", () => {
  it("keeps a story's own image", () => {
    const item = story("https://i.scdn.co/own.jpg")
    expect(withTeaImage(item, { imageUrl: "https://i.scdn.co/x.jpg", palette: ["#000"] })).toBe(
      item,
    )
  })

  it("borrows the entity photo and marks it for a palette tint", () => {
    const out = withTeaImage(story(null), {
      imageUrl: "https://i.scdn.co/x.jpg",
      palette: ["#111111", "#ff0044"],
    })
    expect(out.imageUrl).toBe("https://i.scdn.co/x.jpg")
    expect(overlayPalette(out)).toEqual(["#111111", "#ff0044"])
  })

  it("leaves the story alone when there is no entity photo either", () => {
    const item = story(null)
    expect(withTeaImage(item, { imageUrl: null, palette: ["#000"] })).toBe(item)
  })
})

describe("overlayPalette", () => {
  it("is null for a story's own image and drops anything that isn't a hex colour", () => {
    expect(overlayPalette(story("https://i.scdn.co/own.jpg"))).toBeNull()
    const tinted = {
      ...story("https://i.scdn.co/x.jpg"),
      meta: { imageFallback: true, overlay: "#123456,url(evil),red" },
    }
    expect(overlayPalette(tinted)).toEqual(["#123456"])
  })
})

describe("entityPhoto", () => {
  const pictured = [
    { name: "Bladee", imageUrl: "b.jpg" },
    { name: "fakemink", imageUrl: "f.jpg" },
  ]

  it("uses the artist the headline names", () => {
    expect(entityPhoto("fakemink & Skepta: new single", pictured, 0)).toBe("f.jpg")
  })

  it("rotates through the niche's artists otherwise", () => {
    expect(entityPhoto("Grammy contenders", pictured, 0)).toBe("b.jpg")
    expect(entityPhoto("Grammy contenders", pictured, 1)).toBe("f.jpg")
    expect(entityPhoto("Grammy contenders", [], 1)).toBeNull()
  })
})
