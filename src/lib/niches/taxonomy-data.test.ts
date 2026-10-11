import { describe, expect, it } from "vitest"
import {
  NICHE_PRESETS,
  SEED_PROFILES,
  TAXONOMY,
  artistSpotifyId,
  findSeedProfileByName,
  nicheImage,
} from "./catalog"

/** The brief's tier-1 cluster; "underground hip-hop" lives on as an alias of underground-rap. */
const CLUSTER = [
  "new-gen-underground-rap",
  "rage",
  "jerk",
  "soundcloud-rap",
  "plugg",
  "pluggnb",
  "dark-plugg",
  "tread",
  "cloud-rap",
  "experimental-rap",
  "underground-rap",
  "trap",
  "digicore",
  "hyperpop",
  "sigilkore",
  "glitchcore",
  "deftones-core",
  "nu-gaze",
  "vamp",
  "graphic-gothic-streetwear",
  "dark-streetwear",
  "dark-avant-garde",
  "archive-fashion",
  "underground-graphic-streetwear",
  "diy-reworked",
  "mcbling-revival",
  "underground-sneaker-culture",
]

describe("taxonomy data", () => {
  it("only links brands to verified artists, each with a source", () => {
    for (const brand of TAXONOMY.allBrands()) {
      for (const entry of brand.wornBy) {
        expect(TAXONOMY.artist(entry.artist), `${brand.slug} → ${entry.artist}`).toBeDefined()
        expect(entry.source.startsWith("https://")).toBe(true)
      }
    }
    expect(TAXONOMY.brand("raf-simons")?.wornBy.length).toBeGreaterThan(0)
  })

  it("covers the brands the direction brief names (that could be verified)", () => {
    for (const slug of [
      "rick-owens",
      "raf-simons",
      "undercover",
      "number-nine",
      "vivienne-westwood",
      "chrome-hearts",
      "balenciaga",
      "vetements",
      "vivet",
    ]) {
      expect(TAXONOMY.brand(slug), slug).toBeDefined()
      expect(TAXONOMY.nichesOfBrand(slug).length, slug).toBeGreaterThan(0)
    }
  })

  it("places every cluster niche under a hub branch", () => {
    const orphans = CLUSTER.filter((slug) => !TAXONOMY.branchOf(slug))
    expect(orphans).toEqual([])
  })

  it("features the whole cluster, ahead of the original niches", () => {
    expect([...TAXONOMY.featured()].sort()).toEqual([...CLUSTER].sort())
    const order = NICHE_PRESETS.map((preset) => preset.slug)
    expect(order.slice(0, CLUSTER.length).sort()).toEqual([...CLUSTER].sort())
  })

  it("resolves the brief's aliases case-insensitively", () => {
    const cases: [string, string][] = [
      ["Vamp Aesthetic", "vamp"],
      ["OPIUM FASHION", "vamp"],
      ["rage rap fashion", "vamp"],
      ["Tribal Graphic Fashion", "graphic-gothic-streetwear"],
      ["avant-garde fashion", "dark-avant-garde"],
      ["Archive Streetwear", "archive-fashion"],
      ["underground designer fashion", "archive-fashion"],
      ["distressed streetwear", "diy-reworked"],
      ["Reworked Fashion", "diy-reworked"],
      ["Nu-Metal Revival", "deftones-core"],
      ["Underground Hip-Hop", "underground-rap"],
      ["underground hip hop", "underground-rap"],
    ]
    for (const [text, slug] of cases) expect(findSeedProfileByName(text)?.slug, text).toBe(slug)
  })

  it("links verified artists to every music niche in the cluster", () => {
    const fashion = new Set(TAXONOMY.children("underground-fashion"))
    const bare = CLUSTER.filter((slug) => !fashion.has(slug) && TAXONOMY.artistsOf(slug).length < 3)
    expect(bare).toEqual([])
  })

  it("verifies the artists the brief names", () => {
    for (const name of ["OsamaSon", "Che", "Nettspend"]) {
      expect(artistSpotifyId(name), name).toMatch(/^[0-9A-Za-z]{22}$/)
    }
  })

  it("navigates parent and child niches both ways", () => {
    expect(TAXONOMY.children("new-gen-underground-rap")).toEqual(
      expect.arrayContaining(["rage", "jerk", "plugg", "tread", "soundcloud-rap"]),
    )
    expect(TAXONOMY.parents("pluggnb")).toContain("plugg")
    expect(TAXONOMY.branchOf("pluggnb")).toBe("underground-music")
    expect(TAXONOMY.branchOf("mcbling-revival")).toBe("underground-fashion")
  })

  it("keeps YVL and VIVET as different kinds of entity", () => {
    const yvl = TAXONOMY.node(TAXONOMY.resolve("YVL") ?? "")
    const vivet = TAXONOMY.node(TAXONOMY.resolve("VIVET") ?? "")
    expect(yvl?.type).toBe("identity")
    expect(vivet?.type).toBe("brand")
    expect(TAXONOMY.brandsOf("graphic-gothic-streetwear").map((b) => b.slug)).toContain("vivet")
    expect(TAXONOMY.brandsOf("statement-accessories").map((b) => b.slug)).toContain("vivet")
  })

  it("gives every cluster niche a labelled neighbour or a two-hop recommendation", () => {
    const isolated = CLUSTER.filter(
      (slug) => TAXONOMY.adjacent(slug).length === 0 && TAXONOMY.recommend(slug).length === 0,
    )
    expect(isolated).toEqual([])
  })

  it("only recommends niches that exist, never the niche itself or its direct links", () => {
    const slugs = new Set(SEED_PROFILES.map((p) => p.slug))
    for (const slug of CLUSTER) {
      const direct = new Set([
        ...TAXONOMY.adjacent(slug).map((a) => a.slug),
        ...TAXONOMY.children(slug),
        ...TAXONOMY.parents(slug),
      ])
      for (const rec of TAXONOMY.recommend(slug)) {
        expect(slugs.has(rec), `${slug} → ${rec}`).toBe(true)
        expect(rec).not.toBe(slug)
        expect(direct.has(rec), `${slug} → ${rec}`).toBe(false)
      }
    }
  })

  it("gives featured niches a photo each, never the same one twice", () => {
    const images = TAXONOMY.featured().map((slug) => nicheImage(slug))
    expect(TAXONOMY.featured().filter((slug) => !nicheImage(slug))).toEqual([])
    expect(new Set(images).size).toBe(images.length)
  })
})
