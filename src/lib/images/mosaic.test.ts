import { describe, expect, it } from "vitest"
import { type MosaicTile, MAX_ALBUMS, mosaicPicks } from "./mosaic"

/** Spotify 640px images: their width is known from the URL alone. */
const album = (n: number): MosaicTile => ({
  id: `album-${n}`,
  kind: "album",
  imageUrl: `https://i.scdn.co/image/ab67616d0000b273${String(n).padStart(24, "0")}`,
})
const portrait = (n: number): MosaicTile => ({
  id: `portrait-${n}`,
  kind: "portrait",
  imageUrl: `https://i.scdn.co/image/ab6761610000e5eb${String(n).padStart(24, "a")}`,
})

describe("mosaicPicks", () => {
  it("mixes kinds and caps album covers at two", () => {
    const picks = mosaicPicks([
      ...Array.from({ length: 8 }, (_, i) => album(i)),
      portrait(1),
      portrait(2),
      portrait(3),
      portrait(4),
    ])
    expect(picks.filter((t) => t.kind === "album").length).toBeLessThanOrEqual(MAX_ALBUMS)
    expect(picks[0]?.kind).toBe("portrait")
    expect(picks).toHaveLength(6)
  })

  it("never shows one picture twice (the same album at another size counts)", () => {
    const small = {
      ...album(1),
      id: "album-1-small",
      imageUrl: album(1).imageUrl.replace("b273", "1e02"),
    }
    const picks = mosaicPicks([album(1), small, portrait(1), portrait(2)])
    expect(picks.map((t) => t.id)).not.toContain("album-1-small")
  })

  it("skips low-res images and gives up below three good tiles", () => {
    const thumb: MosaicTile = {
      id: "yt",
      kind: "fit",
      imageUrl: "https://i.ytimg.com/vi/x/hqdefault.jpg",
    }
    expect(mosaicPicks([thumb, album(1), album(2)])).toEqual([])
  })
})
