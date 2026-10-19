import sharp from "sharp"
import { describe, expect, it } from "vitest"
import { analyzeImage, hammingDistance, isSameImage } from "./analyze"

/** A dark canvas with a bright square: a stand-in for "a subject in a frame". */
async function picture(
  width: number,
  height: number,
  spot: { left: number; top: number; size: number; color: string },
) {
  const square = await sharp({
    create: { width: spot.size, height: spot.size, channels: 3, background: spot.color },
  })
    .png()
    .toBuffer()
  return sharp({ create: { width, height, channels: 3, background: "#101010" } })
    .composite([{ input: square, left: spot.left, top: spot.top }])
    .jpeg()
    .toBuffer()
}

describe("analyzeImage", () => {
  it("reads the real size and anchors crops on the subject", async () => {
    const wide = await analyzeImage(
      await picture(800, 600, { left: 620, top: 40, size: 120, color: "#ff3300" }),
    )
    expect(wide).toMatchObject({ width: 800, height: 600, focusY: 0.5 })
    expect(wide.focusX).toBeGreaterThan(0.7)
    const tall = await analyzeImage(
      await picture(600, 900, { left: 240, top: 40, size: 120, color: "#ff3300" }),
    )
    expect(tall.focusX).toBe(0.5)
    expect(tall.focusY).toBeLessThan(0.35)
  })

  it("hashes a resized copy of the same picture as the same image", async () => {
    const original = await picture(800, 600, { left: 100, top: 300, size: 200, color: "#ffffff" })
    const small = await sharp(original).resize(200).jpeg({ quality: 50 }).toBuffer()
    const [a, b] = await Promise.all([analyzeImage(original), analyzeImage(small)])
    expect(isSameImage(a.hash, b.hash)).toBe(true)
  })

  it("tells different pictures apart", async () => {
    const [a, b] = await Promise.all([
      picture(800, 600, { left: 50, top: 50, size: 200, color: "#ffffff" }).then(analyzeImage),
      picture(800, 600, { left: 500, top: 350, size: 200, color: "#ffffff" }).then(analyzeImage),
    ])
    expect(isSameImage(a.hash, b.hash)).toBe(false)
  })
})

describe("hammingDistance", () => {
  it("counts differing bits", () => {
    expect(hammingDistance("0000000000000000", "0000000000000000")).toBe(0)
    expect(hammingDistance("0000000000000000", "000000000000000f")).toBe(4)
    expect(hammingDistance("ffffffffffffffff", "0000000000000000")).toBe(64)
  })
})
