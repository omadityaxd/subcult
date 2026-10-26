import sharp from "sharp"
import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("next/server", () => ({ after: vi.fn() }))

const { makeBlurDataUrl } = await import("./cover-blur")

describe("cover blur placeholder", () => {
  it("shrinks a full-size cover to a tiny inline WebP", async () => {
    const cover = await sharp({
      create: { width: 1200, height: 1500, channels: 3, background: { r: 120, g: 40, b: 200 } },
    })
      .jpeg()
      .toBuffer()
    const url = await makeBlurDataUrl(new Uint8Array(cover).buffer)

    expect(url.startsWith("data:image/webp;base64,")).toBe(true)
    expect(url.length).toBeLessThan(1000) // inline in the HTML without weighing it down
    const decoded = await sharp(Buffer.from(url.split(",")[1], "base64")).metadata()
    expect(decoded.width).toBe(16)
    expect(decoded.height).toBe(20) // keeps the 4:5 shape
  })
})
