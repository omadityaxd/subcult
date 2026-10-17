import { describe, expect, it } from "vitest"
import { cdnImageUrl } from "./cdn"

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
