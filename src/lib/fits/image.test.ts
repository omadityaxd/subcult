import sharp from "sharp"
import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
const { FitImageError, processFitImage } = await import("./image")

async function photoWithMetadata() {
  // 400x200 landscape tagged "rotate 90°" (EXIF orientation 6), with camera EXIF.
  return new Uint8Array(
    await sharp({ create: { width: 400, height: 200, channels: 3, background: "#a31f34" } })
      .withExif({ IFD0: { Copyright: "secret camera owner", Make: "PhoneCo" } })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer(),
  )
}

describe("processFitImage", () => {
  it("strips EXIF, applies orientation and re-encodes as WebP", async () => {
    const input = await photoWithMetadata()
    expect((await sharp(input).metadata()).exif).toBeDefined()

    const { data, width, height } = await processFitImage(input)
    const meta = await sharp(data).metadata()
    expect(meta.format).toBe("webp")
    expect(meta.exif).toBeUndefined()
    expect(meta.orientation).toBeUndefined()
    // Rotated upright: the landscape source is now portrait.
    expect([width, height]).toEqual([200, 400])
  })

  it("caps the long edge at 1440px", async () => {
    const big = new Uint8Array(
      await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#000" } })
        .png()
        .toBuffer(),
    )
    const { width, height } = await processFitImage(big)
    expect(Math.max(width, height)).toBe(1440)
  })

  it("refuses things that aren't photos", async () => {
    await expect(processFitImage(new TextEncoder().encode("<svg></svg>"))).rejects.toBeInstanceOf(
      FitImageError,
    )
    await expect(processFitImage(new Uint8Array())).rejects.toBeInstanceOf(FitImageError)
  })
})
