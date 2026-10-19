import { describe, expect, it } from "vitest"
import {
  STORE_IDS,
  brandLinks,
  reddit,
  resaleSearches,
  social,
  spotify,
  storeLinks,
  youtube,
} from "./links"

describe("deep links", () => {
  it("encodes queries safely", () => {
    expect(spotify.search("arc'teryx & co")).toBe(
      "https://open.spotify.com/search/arc'teryx%20%26%20co",
    )
    expect(youtube.search("how to kickflip")).toBe(
      "https://www.youtube.com/results?search_query=how%20to%20kickflip",
    )
  })

  it("builds reddit top-of-week and in-sub search links", () => {
    expect(reddit.topThisWeek("gorpcore")).toBe("https://www.reddit.com/r/gorpcore/top/?t=week")
    expect(reddit.searchWithin("gorpcore", "fleece")).toContain("/r/gorpcore/search/?q=fleece")
    expect(reddit.searchWithin("gorpcore", "fleece")).toContain("restrict_sr=1")
  })

  it("strips # from instagram tags", () => {
    expect(social.instagramTag("#y2k")).toBe("https://www.instagram.com/explore/tags/y2k/")
  })
})

describe("storeLinks", () => {
  it("covers every global store in a stable order", () => {
    expect(storeLinks("cargo pants").map((link) => link.id)).toEqual([...STORE_IDS])
  })

  it("uses the configured amazon storefront and affiliate tag", () => {
    const [amazon] = storeLinks("cargo pants", {
      amazonDomain: "amazon.in",
      amazonTag: "subcult-21",
    })
    expect(amazon.url).toBe("https://www.amazon.in/s?k=cargo%20pants&tag=subcult-21")
  })

  it("defaults to amazon.com without a tag", () => {
    const [amazon] = storeLinks("beanie")
    expect(amazon.url).toBe("https://www.amazon.com/s?k=beanie")
  })
})

describe("designer stores and brand links", () => {
  it("appends SSENSE and Vestiaire only when a niche opts in", () => {
    const ids = storeLinks("raf simons bomber", undefined, ["ssense", "vestiaire"]).map((l) => l.id)
    expect(ids).toEqual([...STORE_IDS, "ssense", "vestiaire"])
    expect(storeLinks("raf simons bomber", undefined, ["ssense"]).at(-1)?.url).toBe(
      "https://www.ssense.com/en-us/search?q=raf%20simons%20bomber",
    )
  })

  it("links a brand to its official site plus Grailed and Depop resale only", () => {
    const links = brandLinks("VIVET", "https://vivetofficial.com/")
    expect(links.map((l) => l.id)).toEqual(["official", "depop", "grailed"])
    expect(links[0]).toMatchObject({
      url: "https://vivetofficial.com/",
      blurb: "vivetofficial.com",
    })
    expect(links[2].url).toBe("https://www.grailed.com/shop?query=VIVET")
  })

  it("skips the official link when there's no verified site", () => {
    expect(brandLinks("Sp5der", null).map((l) => l.id)).toEqual(["depop", "grailed"])
  })
})

describe("resaleSearches", () => {
  it("searches eBay, Grailed and Depop for one brand", () => {
    const links = resaleSearches("Rick Owens")
    expect(links.map((l) => l.id)).toEqual(["ebay", "depop", "grailed"])
    expect(links[0]?.url).toBe("https://www.ebay.com/sch/i.html?_nkw=Rick%20Owens")
  })
})
