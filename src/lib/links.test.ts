import { describe, expect, it } from "vitest"
import { STORE_IDS, reddit, social, spotify, storeLinks, youtube } from "./links"

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
