import { describe, expect, it } from "vitest"
import { TAXONOMY } from "@/lib/niches/catalog"
import { hubSections, rootHubs } from "./hubs"

describe("hub pages", () => {
  it("only gives top-level hubs their own page", () => {
    expect(rootHubs(TAXONOMY).sort()).toEqual([
      "alt-metal-revival",
      "creator-culture",
      "glow-up",
      "underground",
    ])
  })

  it("lays the underground hub out as its three branches", () => {
    const sections = hubSections(TAXONOMY, "underground")
    expect(sections.map((s) => s.name)).toEqual([
      "Music",
      "Internet Culture",
      "Fashion & Aesthetics",
    ])
  })

  it("includes sub-niches after their parents, each niche once", () => {
    const music = hubSections(TAXONOMY, "underground")[0].niches
    expect(music.indexOf("new-gen-underground-rap")).toBeLessThan(music.indexOf("rage"))
    expect(music).toContain("pluggnb")
    const all = hubSections(TAXONOMY, "underground").flatMap((s) => s.niches)
    expect(new Set(all).size).toBe(all.length)
  })

  it("lists a branchless hub's niches directly", () => {
    const [section] = hubSections(TAXONOMY, "alt-metal-revival")
    expect(section.niches).toEqual(["deftones-core", "nu-gaze"])
  })

  it("returns nothing for unknown hubs", () => {
    expect(hubSections(TAXONOMY, "nope")).toEqual([])
  })
})
