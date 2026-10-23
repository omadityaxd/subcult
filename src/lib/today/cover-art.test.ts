import { describe, expect, it } from "vitest"
import type { ImageFacts } from "@/lib/images/facts"
import { chooseCoverArt } from "./cover-art"

const sized = (width: number): ImageFacts => ({
  width,
  height: width,
  hash: "0".repeat(16),
  focusX: 0.5,
  focusY: 0.5,
})

describe("chooseCoverArt", () => {
  const carti = { imageUrl: "https://i.scdn.co/image/carti", label: "Playboi Carti" }
  const ken = { imageUrl: "https://i.scdn.co/image/ken", label: "Ken Carson" }

  it("prints the best-quality artist portrait full-bleed", () => {
    const facts = new Map([
      [carti.imageUrl, sized(320)],
      [ken.imageUrl, sized(640)],
    ])
    expect(chooseCoverArt([carti, ken], [], facts)).toEqual({
      kind: "portrait",
      imageUrl: ken.imageUrl,
      label: "Ken Carson",
    })
  })

  it("the lead artist wins a tie", () => {
    const facts = new Map([
      [carti.imageUrl, sized(640)],
      [ken.imageUrl, sized(640)],
    ])
    expect(chooseCoverArt([carti, ken], [], facts)).toMatchObject({ label: "Playboi Carti" })
  })

  it("falls back to a mosaic of three different pictures when no portrait is sharp", () => {
    const facts = new Map([[carti.imageUrl, sized(160)]])
    const art = chooseCoverArt(
      [carti],
      ["https://img/a.jpg", "https://img/a.jpg", "https://img/b.jpg"],
      facts,
    )
    expect(art).toEqual({
      kind: "mosaic",
      images: [carti.imageUrl, "https://img/a.jpg", "https://img/b.jpg"],
    })
  })

  it("gives up (palette cover) with fewer than three pictures", () => {
    expect(chooseCoverArt([], ["https://img/a.jpg"], new Map())).toBeNull()
  })
})
