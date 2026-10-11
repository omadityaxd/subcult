import { describe, expect, it } from "vitest"
import { decodeRelatedNiches, encodeRelatedNiches } from "./related-niches"

describe("related niches meta", () => {
  it("round-trips and ignores junk", () => {
    const niches = [
      { slug: "rage", name: "rage" },
      { slug: "new-gen-underground-rap", name: "new-gen underground rap" },
    ]
    expect(decodeRelatedNiches(encodeRelatedNiches(niches))).toEqual(niches)
    expect(decodeRelatedNiches(42)).toEqual([])
    expect(decodeRelatedNiches("Bad Slug:x|ok:fine")).toEqual([{ slug: "ok", name: "fine" }])
  })
})
