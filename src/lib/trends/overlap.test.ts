import { describe, expect, it } from "vitest"
import { findOverlap, stemTokens } from "./overlap"
import type { ExistingNiche } from "./types"

const existing: ExistingNiche[] = [
  { slug: "gorpcore", name: "gorpcore", relatedNiches: ["techwear"] },
  { slug: "coastal-cowboy", name: "coastal cowboy", relatedNiches: ["cottagecore"] },
  { slug: "old-money", name: "old money", relatedNiches: ["dark academia", "tennis core"] },
]

describe("stemTokens", () => {
  it("strips aesthetic-minting suffixes", () => {
    expect([...stemTokens("gorpcore")]).toEqual(["gorp"])
    expect([...stemTokens("coastal cowgirl")]).toEqual(["coastal", "cow"])
    expect([...stemTokens("tennis core")]).toEqual(["tennis"])
  })
})

describe("findOverlap", () => {
  it("flags exact slugs", () => {
    expect(findOverlap({ slug: "gorpcore", name: "gorpcore" }, existing)).toMatch(/already exists/)
  })

  it("flags suffix variants of existing niches", () => {
    expect(findOverlap({ slug: "gorp-girlies", name: "gorp girlies" }, existing)).toMatch(
      /overlaps existing niche gorpcore/,
    )
    expect(findOverlap({ slug: "coastal-cowgirl", name: "coastal cowgirl" }, existing)).toMatch(
      /coastal-cowboy/,
    )
  })

  it("flags scenes already referenced as related niches", () => {
    expect(findOverlap({ slug: "tenniscore", name: "tenniscore" }, existing)).toMatch(
      /related to old-money/,
    )
  })

  it("lets genuinely new niches through", () => {
    expect(findOverlap({ slug: "mermaidcore", name: "mermaidcore" }, existing)).toBeNull()
    expect(findOverlap({ slug: "office-siren", name: "office siren" }, existing)).toBeNull()
  })
})
