import { describe, expect, it } from "vitest"
import { getListing, largeImage, searchListings } from "./ebay"

const credentials = { clientId: "id", clientSecret: "secret" }

function fakeEbay(routes: Record<string, unknown>) {
  const calls: { url: string; init?: RequestInit }[] = []
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (url.includes("/oauth2/token")) return Response.json({ access_token: "t", expires_in: 7200 })
    const key = Object.keys(routes).find((path) => url.includes(path))
    return key ? Response.json(routes[key]) : new Response("nope", { status: 404 })
  }) as unknown as typeof fetch
  return { fetchImpl, calls }
}

describe("eBay Browse", () => {
  it("searches clothing with an app token and the US marketplace header", async () => {
    const { fetchImpl, calls } = fakeEbay({
      "/item_summary/search": {
        itemSummaries: [
          {
            itemId: "v1|123456789|0",
            title: "Rick Owens FW06 Dustulator",
            price: { value: "1450.00", currency: "USD" },
            image: { imageUrl: "https://i.ebayimg.com/images/g/abc/s-l225.jpg" },
            condition: "Pre-owned",
            seller: { username: "archive_dealer" },
            itemWebUrl: "https://www.ebay.com/itm/123456789",
          },
          { itemId: "v1|2|0", title: "no price", itemWebUrl: "https://www.ebay.com/itm/2" },
        ],
      },
    })
    const listings = await searchListings("Rick Owens", credentials, { fetchImpl })
    expect(listings).toHaveLength(1)
    expect(listings[0]).toMatchObject({
      price: 1450,
      imageUrl: "https://i.ebayimg.com/images/g/abc/s-l500.jpg",
    })
    const search = calls.find((call) => call.url.includes("item_summary"))
    expect(search?.url).toContain("category_ids=11450")
    const headers = search?.init?.headers as Record<string, string>
    expect(headers.Authorization).toBe("Bearer t")
    expect(headers["X-EBAY-C-MARKETPLACE-ID"]).toBe("EBAY_US")
  })

  it("reads gallery and size from the item detail", async () => {
    const { fetchImpl } = fakeEbay({
      "/item/": {
        itemId: "v1|123456789|0",
        title: "Raf Simons parka",
        price: { value: "4200", currency: "USD" },
        image: { imageUrl: "https://i.ebayimg.com/a/s-l225.jpg" },
        additionalImages: [{ imageUrl: "https://i.ebayimg.com/b/s-l225.jpg" }],
        localizedAspects: [{ name: "Size", value: "48" }],
        itemWebUrl: "https://www.ebay.com/itm/123456789",
      },
    })
    const listing = await getListing("v1|123456789|0", credentials, fetchImpl)
    expect(listing?.size).toBe("48")
    expect(listing?.images).toEqual([
      "https://i.ebayimg.com/a/s-l1600.jpg",
      "https://i.ebayimg.com/b/s-l1600.jpg",
    ])
    expect(largeImage("https://x/s-l140.webp")).toBe("https://x/s-l1600.webp")
  })
})
