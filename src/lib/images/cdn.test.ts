import { describe, expect, it } from "vitest"
import { cdnImageUrl, cdnLoader, isResizable } from "./cdn"

describe("cdnImageUrl", () => {
  it("picks Spotify's smallest variant that still covers the slot", () => {
    const artist = "https://i.scdn.co/image/ab6761610000e5eb837aeb70fbd21f9587dab56e"
    expect(cdnImageUrl(artist, 96)).toBe(
      "https://i.scdn.co/image/ab6761610000f178837aeb70fbd21f9587dab56e",
    )
    expect(cdnImageUrl(artist, 256)).toBe(
      "https://i.scdn.co/image/ab67616100005174837aeb70fbd21f9587dab56e",
    )
    expect(cdnImageUrl(artist, 1080)).toBe(artist)
    const album = "https://i.scdn.co/image/ab67616d0000b273aaa"
    expect(cdnImageUrl(album, 200)).toBe("https://i.scdn.co/image/ab67616d00001e02aaa")
  })

  it("resizes iTunes, eBay, Unsplash and Pexels by URL", () => {
    expect(cdnImageUrl("https://is1-ssl.mzstatic.com/x/600x600bb.jpg", 256)).toBe(
      "https://is1-ssl.mzstatic.com/x/250x250bb.jpg",
    )
    expect(cdnImageUrl("https://i.ebayimg.com/images/g/abc/s-l1600.jpg", 384)).toBe(
      "https://i.ebayimg.com/images/g/abc/s-l400.jpg",
    )
    expect(cdnImageUrl("https://images.unsplash.com/photo-1?ixid=x&w=1080", 640)).toBe(
      "https://images.unsplash.com/photo-1?ixid=x&w=640",
    )
  })

  it("leaves unknown hosts and bad URLs alone", () => {
    expect(cdnImageUrl("https://example.com/a.jpg", 100)).toBe("https://example.com/a.jpg")
    expect(cdnImageUrl("/local.png", 100)).toBe("/local.png")
  })
})

describe("cdnLoader", () => {
  it("always varies with width, so next/image knows it's implemented", () => {
    const youtube = "https://i.ytimg.com/vi/x/hqdefault.jpg"
    expect(cdnLoader({ src: youtube, width: 400 })).toBe(`${youtube}#w=400`)
    const spotify = "https://i.scdn.co/image/ab6761610000e5eb35033cc5f61a8529cb15f1de"
    expect(cdnLoader({ src: spotify, width: 400 })).not.toBe(spotify)
  })

  it("knows which hosts have variants", () => {
    expect(isResizable("https://i.ytimg.com/vi/x/hqdefault.jpg")).toBe(false)
    expect(isResizable("https://i.ebayimg.com/images/g/x/s-l500.jpg")).toBe(true)
  })
})

describe("WordPress images", () => {
  it("asks WordPress for the width it needs", () => {
    const src =
      "https://lede-admin.stereogum.com/wp-content/uploads/sites/64/2026/10/fakemink.jpeg?w=564"
    expect(cdnImageUrl(src, 1200)).toBe(
      "https://lede-admin.stereogum.com/wp-content/uploads/sites/64/2026/10/fakemink.jpeg?w=1200",
    )
    expect(isResizable(src)).toBe(true)
  })

  it("leaves WordPress images without a width alone", () => {
    const src = "https://example.com/wp-content/uploads/a.jpg"
    expect(cdnImageUrl(src, 1200)).toBe(src)
  })
})
