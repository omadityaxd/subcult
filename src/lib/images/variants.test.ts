import { describe, expect, it } from "vitest"
import { bestVariant, canonicalImage, knownWidth } from "./variants"

const ALBUM_640 = "https://i.scdn.co/image/ab67616d0000b2734eba3a1d0a6f9a7a1b2c3d4e"
const ALBUM_300 = "https://i.scdn.co/image/ab67616d00001e024eba3a1d0a6f9a7a1b2c3d4e"
const PORTRAIT_160 = "https://i.scdn.co/image/ab6761610000f17835033cc5f61a8529cb15f1de"

describe("image variants", () => {
  it("upgrades every source to its biggest variant", () => {
    expect(bestVariant(ALBUM_300)).toBe(ALBUM_640)
    expect(bestVariant(PORTRAIT_160)).toBe(
      "https://i.scdn.co/image/ab6761610000e5eb35033cc5f61a8529cb15f1de",
    )
    expect(bestVariant("https://is1-ssl.mzstatic.com/image/a/100x100bb.jpg")).toBe(
      "https://is1-ssl.mzstatic.com/image/a/1200x1200bb.jpg",
    )
    expect(bestVariant("https://i.ebayimg.com/images/g/x/s-l500.jpg")).toBe(
      "https://i.ebayimg.com/images/g/x/s-l1600.jpg",
    )
  })

  it("knows widths the URL promises", () => {
    expect(knownWidth(ALBUM_640)).toBe(640)
    expect(knownWidth("https://i.ytimg.com/vi/abc/hqdefault.jpg")).toBe(480)
    expect(knownWidth("https://i.ytimg.com/vi/abc/maxresdefault.jpg")).toBe(1280)
    expect(knownWidth("https://is1-ssl.mzstatic.com/image/a/600x600bb.jpg")).toBe(600)
    expect(knownWidth("https://example.com/photo.jpg")).toBeNull()
  })

  it("gives every size of one picture the same key", () => {
    expect(canonicalImage(ALBUM_300)).toBe(canonicalImage(ALBUM_640))
    expect(canonicalImage("https://i.ytimg.com/vi/abc/hqdefault.jpg")).toBe(
      canonicalImage("https://i.ytimg.com/vi/abc/maxresdefault.jpg"),
    )
    expect(canonicalImage("https://is1-ssl.mzstatic.com/a/100x100bb.jpg")).toBe(
      canonicalImage("https://is1-ssl.mzstatic.com/a/600x600bb.jpg"),
    )
    expect(canonicalImage("https://x.com/a.jpg?w=564")).toBe(canonicalImage("https://x.com/a.jpg"))
    expect(canonicalImage(ALBUM_640)).not.toBe(canonicalImage(PORTRAIT_160))
  })
})
