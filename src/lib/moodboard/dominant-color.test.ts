import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
const { dominantFromPixels, isAllowedImageUrl } = await import("./dominant-color")

const pixels = (...colors: [number, number, number, number][]) =>
  new Uint8Array(
    colors.flatMap(([r, g, b, n]) => Array.from({ length: n }, () => [r, g, b]).flat()),
  )

describe("dominantFromPixels", () => {
  it("ignores a white studio background in favour of the product", () => {
    expect(dominantFromPixels(pixels([255, 255, 255, 300], [163, 31, 52, 100]), 3)).toBe("#a31f34")
  })

  it("falls back to neutral when the image is all neutral", () => {
    expect(dominantFromPixels(pixels([250, 250, 250, 10]), 3)).toBe("#fafafa")
  })
})

describe("isAllowedImageUrl", () => {
  it("only fetches known image CDNs over https", () => {
    expect(isAllowedImageUrl("https://i.scdn.co/image/abc")).toBe(true)
    expect(isAllowedImageUrl("https://is1-ssl.mzstatic.com/image/x.jpg")).toBe(true)
    expect(isAllowedImageUrl("http://i.scdn.co/image/abc")).toBe(false)
    expect(isAllowedImageUrl("https://169.254.169.254/latest")).toBe(false)
    expect(isAllowedImageUrl("https://evil.com/?u=i.scdn.co")).toBe(false)
  })
})
