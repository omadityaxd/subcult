import { describe, expect, it } from "vitest"
import { arenaChannelPins, pexelsPins, unsplashPins } from "./sources"

const respond = (body: unknown) => (async () => Response.json(body)) as unknown as typeof fetch

describe("arenaChannelPins", () => {
  it("keeps image blocks, hides filename titles and links back to the block", async () => {
    const pins = await arenaChannelPins("nu-metal", {
      fetchImpl: respond({
        data: [
          {
            id: 1,
            type: "Image",
            title: "slipknot.jpg",
            image: { src: "https://o/1.jpg", small: { src: "https://s/1" } },
            user: { name: "Daria" },
          },
          { id: 2, type: "Text", title: "notes" },
        ],
      }),
    })
    expect(pins).toHaveLength(1)
    expect(pins[0]).toMatchObject({
      imageUrl: "https://s/1",
      title: null,
      pageUrl: "https://www.are.na/block/1",
    })
    expect(pins[0].credit?.label).toBe("Saved by Daria on Are.na")
  })
})

describe("unsplashPins", () => {
  it("credits the photographer with Unsplash's referral params", async () => {
    const [photo] = await unsplashPins("leather", {
      key: "k",
      fetchImpl: respond({
        results: [
          {
            id: "x",
            width: 400,
            height: 600,
            color: "#262626",
            urls: {
              small: "https://images.unsplash.com/s",
              regular: "https://images.unsplash.com/r",
            },
            links: {
              html: "https://unsplash.com/photos/x",
              download_location: "https://api.unsplash.com/photos/x/download",
            },
            user: { name: "Jane", links: { html: "https://unsplash.com/@jane" } },
          },
        ],
      }),
    })
    expect(photo.credit?.label).toBe("Photo by Jane on Unsplash")
    expect(photo.credit?.url).toContain("utm_source=subcult")
    expect(photo.pageUrl).toContain("utm_medium=referral")
    expect(photo.color).toBe("#262626")
  })
})

describe("pexelsPins", () => {
  it("uses Pexels' average color and credits the photographer", async () => {
    const [photo] = await pexelsPins("chrome", {
      key: "k",
      fetchImpl: respond({
        photos: [
          {
            id: 7,
            width: 400,
            height: 600,
            url: "https://www.pexels.com/photo/7",
            alt: "chrome ring",
            avg_color: "#AABBCC",
            photographer: "Sam",
            photographer_url: "https://www.pexels.com/@sam",
            src: { medium: "https://images.pexels.com/m", large: "https://images.pexels.com/l" },
          },
        ],
      }),
    })
    expect(photo).toMatchObject({ color: "#aabbcc", title: "chrome ring" })
    expect(photo.credit?.label).toBe("Photo by Sam on Pexels")
  })
})
